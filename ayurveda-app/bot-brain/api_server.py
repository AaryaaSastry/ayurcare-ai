from fastapi import FastAPI, HTTPException, Body, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone
from time import perf_counter
import json
import os
import asyncio
from dotenv import load_dotenv
from bot import extract_symptoms_from_text, get_next_question, diagnose, should_give_diagnosis
from gemini_client import send, reset_trace, get_trace_snapshot

load_dotenv()

# ─── App & DB setup ──────────────────────────────────────────────────────────
app = FastAPI(title="AyurvedaBot AI API")

MONGODB_URI = os.getenv("MONGODB_URI", "")
JWT_SECRET = os.getenv("JWT_SECRET", "doctor_portal_secret_key_123")

mongo_client: AsyncIOMotorClient = None
db = None


async def create_indexes_in_background():
    """Create indexes in background without blocking startup"""
    try:
        if db is None:
            print("⚠️ Database not initialized, skipping index creation")
            return
        
        await asyncio.sleep(2)  # Wait for connection to stabilize
        await db.chat_sessions.create_index("userId")
        await db.chat_sessions.create_index("updatedAt")
        print("✅ MongoDB indexes created successfully")
    except Exception as e:
        print(f"⚠️ Failed to create indexes (non-critical): {str(e)}")

@app.on_event("startup")
async def startup():
    global mongo_client, db
    try:
        print(f"⏳ Connecting to MongoDB Atlas: {MONGODB_URI[:25]}...")
        
        mongo_client = AsyncIOMotorClient(
            MONGODB_URI,
            serverSelectionTimeoutMS=10000,
            connectTimeoutMS=15000
        )
        
        # Test connection
        await mongo_client.admin.command('ping')
        print("✅ FastAPI connected to MongoDB Atlas successfully!")
        
        db = mongo_client["doctor_portal"]
        print("✅ Database initialized")
        
        # Create indexes in background
        asyncio.create_task(create_indexes_in_background())
    
    except Exception as e:
        print(f"❌ MongoDB initialization error: {str(e)}")


@app.on_event("shutdown")
async def shutdown():
    global mongo_client, db
    if mongo_client:
        mongo_client.close()


async def ensure_db_connected():
    """Retry connection if db is None. Called by endpoints when needed."""
    global mongo_client, db
    if db is not None:
        return True
    
    try:
        print("🔄 Retrying MongoDB connection...")
        connection_string = MONGODB_URI
        if "?" not in connection_string:
            connection_string += "?"
        else:
            connection_string += "&"
        connection_string += "tlsAllowInvalidCertificates=true"
        
        mongo_client = AsyncIOMotorClient(
            connection_string,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000
        )
        
        await asyncio.wait_for(mongo_client.admin.command('ping'), timeout=5)
        db = mongo_client["doctor_portal"]
        print("✅ MongoDB reconnected successfully!")
        return True
    except Exception as e:
        print(f"❌ Reconnection failed: {str(e)}")
        return False


# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-memory AI state (keyed by sessionId, cleared on restart is fine) ─────
ai_sessions: dict = {}


def get_ai_session(session_id: str) -> dict:
    if session_id not in ai_sessions:
        ai_sessions[session_id] = {
            "symptoms": [],
            "answers": {},
            "conversation_history": [],
            "diagnosis_complete": False,
            "confirmed_disease": None,
            "diagnosis_text": None
        }
    return ai_sessions[session_id]


# ─── Helpers ──────────────────────────────────────────────────────────────────
def serialize_session(doc: dict) -> dict:
    """Convert MongoDB doc to JSON-safe dict."""
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    if "userId" in doc and isinstance(doc["userId"], ObjectId):
        doc["userId"] = str(doc["userId"])
    return doc


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _timing_entry(stage: str, start_time: float) -> dict:
    return {"stage": stage, "latency_ms": round((perf_counter() - start_time) * 1000, 2)}


def _build_telemetry(timings: list) -> dict:
    llm_trace = get_trace_snapshot()
    llm_total = round(sum(item.get("latency_ms", 0) for item in llm_trace), 2)
    total = round(sum(item.get("latency_ms", 0) for item in timings), 2)
    return {
        "timings": timings,
        "llm_calls": len(llm_trace),
        "llm_total_ms": llm_total,
        "llm_trace": llm_trace,
        "measured_total_ms": total,
    }


# ─── Chat Session CRUD endpoints ──────────────────────────────────────────────

@app.post("/api/chat/create")
async def create_chat_session(data: dict = Body(...)):
    """Create a new empty chat session for a user."""
    # Try to ensure DB is connected
    if not await ensure_db_connected():
        raise HTTPException(status_code=503, detail="Database connection failed. Please try again.")
    
    user_id_str = data.get("userId")
    if not user_id_str:
        raise HTTPException(status_code=400, detail="userId is required")

    try:
        user_oid = ObjectId(user_id_str)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid userId")

    now = utcnow()
    session_doc = {
        "userId": user_oid,
        "title": "New consultation",
        "messages": [],
        "diagnosis": None,
        "recipesText": None,
        "showPostReportOptions": False,
        "hasAskedAboutReport": False,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.chat_sessions.insert_one(session_doc)
    session_doc["_id"] = str(result.inserted_id)
    session_doc["userId"] = user_id_str
    return serialize_session(session_doc)


@app.get("/api/chat/sessions/{user_id}")
async def get_user_sessions(user_id: str):
    """Return all chat sessions for a user (summary only)."""
    # Try to ensure DB is connected
    if not await ensure_db_connected():
        raise HTTPException(
            status_code=503, 
            detail="Database connection failed. MongoDB Atlas may be unavailable. Check your internet connection."
        )
    
    try:
        user_oid = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid userId")

    try:
        cursor = db.chat_sessions.find(
            {"userId": user_oid},
            {"title": 1, "updatedAt": 1, "createdAt": 1, "diagnosis": 1, "recipesText": 1,
             "showPostReportOptions": 1, "hasAskedAboutReport": 1}
        ).sort("updatedAt", -1)

        sessions = []
        async for doc in cursor:
            sessions.append(serialize_session(doc))
        return sessions
    except Exception as e:
        print(f"❌ [get_user_sessions] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching sessions: {str(e)}")


@app.get("/api/chat/session/{session_id}")
async def get_session(session_id: str):
    """Return a full session including all messages."""
    if not await ensure_db_connected():
        raise HTTPException(status_code=503, detail="Database connection failed. Please try again.")
    
    try:
        session_oid = ObjectId(session_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid sessionId")

    doc = await db.chat_sessions.find_one({"_id": session_oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return serialize_session(doc)


@app.delete("/api/chat/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a chat session."""
    if not await ensure_db_connected():
        raise HTTPException(status_code=503, detail="Database connection failed. Please try again.")
    
    try:
        session_oid = ObjectId(session_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid sessionId")

    result = await db.chat_sessions.delete_one({"_id": session_oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    # Clean up in-memory AI state too
    ai_sessions.pop(session_id, None)
    return {"success": True}


@app.patch("/api/chat/session/{session_id}")
async def update_session_meta(session_id: str, data: dict = Body(...)):
    """Update showPostReportOptions / hasAskedAboutReport flags."""
    if not await ensure_db_connected():
        raise HTTPException(status_code=503, detail="Database connection failed. Please try again.")
    
    try:
        session_oid = ObjectId(session_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid sessionId")

    allowed = {"showPostReportOptions", "hasAskedAboutReport", "recipesText"}
    update_data = {k: v for k, v in data.items() if k in allowed}
    update_data["updatedAt"] = utcnow()

    doc = await db.chat_sessions.find_one_and_update(
        {"_id": session_oid},
        {"$set": update_data},
        return_document=True
    )
    return serialize_session(doc)


# ─── Core /ask endpoint (now DB-backed) ───────────────────────────────────────

@app.post("/ask")
async def ask(user_id: str = "default_session", data: dict = Body(...)):
    """
    Main chat endpoint. user_id here is the sessionId (from frontend query param).
    Persists messages to MongoDB.
    """
    if not await ensure_db_connected():
        raise HTTPException(status_code=503, detail="Database connection failed. Please try again.")
    
    session_id = user_id  # frontend sends ?user_id=<sessionId>
    message = data.get("message", "")
    diagnosis_context = data.get("diagnosis", "")
    timings = []
    request_start = perf_counter()
    reset_trace()

    # Load/init AI state for this session
    ai_state = get_ai_session(session_id)

    # If session_id looks like a MongoDB ObjectId, try to restore AI state from DB
    if len(session_id) == 24:
        try:
            db_restore_start = perf_counter()
            session_oid = ObjectId(session_id)
            db_session = await db.chat_sessions.find_one({"_id": session_oid})
            timings.append(_timing_entry("db_restore_session", db_restore_start))
            if db_session and not ai_state["conversation_history"]:
                # Restore history from stored messages so AI has context
                for msg in db_session.get("messages", []):
                    role = msg.get("role", "")
                    text = msg.get("text", "")
                    if role == "user":
                        ai_state["conversation_history"].append(f"User: {text}")
                    elif role == "bot" and text and not msg.get("isThinking"):
                        ai_state["conversation_history"].append(text)
                # Restore diagnosis state
                if db_session.get("diagnosis"):
                    ai_state["diagnosis_complete"] = True
                    ai_state["diagnosis_text"] = db_session["diagnosis"]
                    # Add report to history if not there
                    if not any("---REPORT_DATA---" in str(h) for h in ai_state["conversation_history"]):
                        ai_state["conversation_history"].append(db_session["diagnosis"])
        except Exception:
            pass

    # Handle diagnosis context
    if diagnosis_context and not ai_state.get("diagnosis_complete"):
        ai_state["diagnosis_complete"] = True
        ai_state["diagnosis_text"] = diagnosis_context

    # Build message to save
    now = utcnow()

    if message == "START_CONVERSATION":
        # Just get the greeting – don't save user message
        next_q = get_next_question(ai_state["symptoms"], ai_state["conversation_history"])
        ai_state["conversation_history"].append(next_q)

        # Save bot greeting to DB (split by bubble separator)
        if session_id and len(session_id) == 24:
            try:
                bubbles = [b.strip() for b in next_q.split("---NEXT_BUBBLE---") if b.strip()]
                bot_msgs = [{"role": "bot", "text": b, "timestamp": now} for b in bubbles]
                await db.chat_sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {"$push": {"messages": {"$each": bot_msgs}}, "$set": {"updatedAt": now}}
                )
            except Exception:
                pass

        return {"type": "question", "content": next_q,
                "intelligence": {"symptoms": ai_state["symptoms"], "progress": 0}}

    # Save user message to DB
    user_msg_doc = {"role": "user", "text": message, "timestamp": now}
    if session_id and len(session_id) == 24:
        try:
            db_user_write_start = perf_counter()
            await db.chat_sessions.update_one(
                {"_id": ObjectId(session_id)},
                {"$push": {"messages": user_msg_doc}, "$set": {"updatedAt": now}}
            )
            timings.append(_timing_entry("db_save_user_message", db_user_write_start))
        except Exception:
            pass

    ai_state["conversation_history"].append(f"User: {message}")
    symptom_start = perf_counter()
    extracted = extract_symptoms_from_text(message)
    timings.append(_timing_entry("symptom_extraction", symptom_start))
    if extracted:
        ai_state["symptoms"].extend(extracted)
        ai_state["symptoms"] = list(set(ai_state["symptoms"]))

    # Follow-up after diagnosis
    if ai_state.get("diagnosis_complete"):
        # Ensure the diagnosis report is in the conversation history for context
        if not any("---REPORT_DATA---" in str(h) for h in ai_state["conversation_history"]):
            diag_text = ai_state.get("diagnosis_text") or diagnosis_context
            if diag_text:
                ai_state["conversation_history"].insert(0, diag_text)

        post_report_start = perf_counter()
        next_q = get_next_question(ai_state["symptoms"], ai_state["conversation_history"])
        timings.append(_timing_entry("post_report_answer", post_report_start))
        ai_state["conversation_history"].append(next_q)

        if session_id and len(session_id) == 24:
            try:
                bubbles = [b.strip() for b in next_q.split("---NEXT_BUBBLE---") if b.strip()]
                bot_msgs = [{"role": "bot", "text": b, "timestamp": utcnow()} for b in bubbles]
                db_post_report_write_start = perf_counter()
                await db.chat_sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {"$push": {"messages": {"$each": bot_msgs}}, "$set": {"updatedAt": utcnow()}}
                )
                timings.append(_timing_entry("db_save_post_report_answer", db_post_report_write_start))
            except Exception as e:
                print(f"Error saving bot response: {e}")
        timings.append(_timing_entry("request_total", request_start))
        telemetry = _build_telemetry(timings)
        print(f"[ASK TRACE] session={session_id} telemetry={json.dumps(telemetry, default=str)}")
        return {"type": "question", "content": next_q,
                "intelligence": {"symptoms": ai_state["symptoms"], "progress": 100}, "telemetry": telemetry}

    # Should we diagnose now?
    readiness_start = perf_counter()
    if should_give_diagnosis(ai_state["symptoms"], ai_state["answers"], ai_state["conversation_history"]):
        timings.append(_timing_entry("diagnosis_readiness_check", readiness_start))
        diagnosis_start = perf_counter()
        diagnosis = diagnose(ai_state["symptoms"], ai_state["conversation_history"])
        timings.append(_timing_entry("diagnosis_generation", diagnosis_start))
        ai_state["diagnosis_complete"] = True
        ai_state["diagnosis_text"] = diagnosis
        ai_state["conversation_history"].append(diagnosis)

        # Parse title from diagnosis
        title = _extract_title(diagnosis)
        # Extract ONLY the JSON part for the report renderer
        report_json = diagnosis.split("---REPORT_DATA---")[-1] if "---REPORT_DATA---" in diagnosis else diagnosis
        # Clean markdown code blocks if present
        report_json = report_json.replace("```json", "").replace("```", "").strip()

        reports_payload = None
        reports_list = []
        try:
            reports_payload = json.loads(report_json)
            if isinstance(reports_payload, dict) and isinstance(reports_payload.get("reports"), list):
                reports_list = [r for r in reports_payload.get("reports", []) if isinstance(r, dict)]
        except Exception:
            reports_payload = None
        
        diagnosis_msg_doc = {"role": "report", "text": report_json, "timestamp": utcnow()}
        if session_id and len(session_id) == 24:
            try:
                # 1. Update the chat session
                db_report_save_start = perf_counter()
                session_update = {
                    "$push": {"messages": diagnosis_msg_doc},
                    "$set": {
                        "diagnosis": report_json,
                        "title": title,
                        "updatedAt": utcnow()
                    }
                }
                if reports_list:
                    session_update["$set"]["reports"] = reports_list

                await db.chat_sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    session_update
                )
                timings.append(_timing_entry("db_save_report_to_session", db_report_save_start))
                
                # 2. ALSO save to reports collection so it shows up in "My Consultations"
                # get session info to find user_id
                db_fetch_session_start = perf_counter()
                session = await db.chat_sessions.find_one({"_id": ObjectId(session_id)})
                timings.append(_timing_entry("db_fetch_session_for_report", db_fetch_session_start))
                if session and "userId" in session:
                    # Clean the JSON for specific fields if we want, or just store the diagnosis string
                    # The reports page expects diagnosis, symptoms, recommendations, date
                    try:
                        db_insert_report_start = perf_counter()
                        if reports_list:
                            report_docs = []
                            for r in reports_list:
                                report_type = r.get("reportType") or "Diagnosis Report"
                                report_title = r.get("title") or report_type
                                report_data = r.get("reportData") if isinstance(r.get("reportData"), dict) else {}
                                diagnosis_name = ""
                                diagnosis_value = report_data.get("diagnosis")
                                if isinstance(diagnosis_value, dict):
                                    diagnosis_name = diagnosis_value.get("name", "")
                                elif isinstance(diagnosis_value, str):
                                    diagnosis_name = diagnosis_value

                                symptom_items = report_data.get("symptomSeverity", [])
                                symptoms_list = []
                                if isinstance(symptom_items, list):
                                    for s in symptom_items:
                                        if isinstance(s, dict) and s.get("symptom"):
                                            symptoms_list.append(s.get("symptom"))
                                if not symptoms_list and isinstance(report_data.get("symptomsReported"), list):
                                    symptoms_list = report_data.get("symptomsReported", [])

                                lifestyle_value = report_data.get("lifestyleChanges")
                                if isinstance(lifestyle_value, list):
                                    recommendations = ". ".join(lifestyle_value)
                                else:
                                    recommendations = lifestyle_value or ""

                                report_docs.append({
                                    "patientId": session["userId"],
                                    "sessionId": ObjectId(session_id),
                                    "reportType": report_type,
                                    "reportTitle": report_title,
                                    "reportData": report_data,
                                    "diagnosis": diagnosis_name or title,
                                    "symptoms": ", ".join(symptoms_list) if symptoms_list else "",
                                    "recommendations": recommendations,
                                    "date": utcnow().strftime("%Y-%m-%d"),
                                    "createdAt": utcnow()
                                })

                            if report_docs:
                                await db.reports.insert_many(report_docs)
                        else:
                            rj = json.loads(report_json)
                            await db.reports.insert_one({
                                "patientId": session["userId"],
                                "sessionId": ObjectId(session_id),
                                "diagnosis": rj.get("diagnosis", {}).get("name", title) if isinstance(rj.get("diagnosis"), dict) else rj.get("diagnosis", title),
                                "symptoms": ", ".join(rj.get("symptomsReported", [])) if isinstance(rj.get("symptomsReported"), list) else rj.get("symptomsReported", ""),
                                "recommendations": ". ".join(rj.get("lifestyleChanges", [])) if isinstance(rj.get("lifestyleChanges"), list) else rj.get("lifestyleChanges", ""),
                                "date": utcnow().strftime("%Y-%m-%d"),
                                "createdAt": utcnow()
                            })
                        timings.append(_timing_entry("db_insert_report_summary", db_insert_report_start))
                    except Exception as e:
                        print(f"Error parsing JSON for report save: {e}")
                        # Fallback if JSON fails
                        db_insert_report_fallback_start = perf_counter()
                        await db.reports.insert_one({
                            "patientId": session["userId"],
                            "sessionId": ObjectId(session_id),
                            "diagnosis": title,
                            "symptoms": "AI Assessment",
                            "recommendations": "Review session history",
                            "date": utcnow().strftime("%Y-%m-%d"),
                            "createdAt": utcnow()
                        })
                        timings.append(_timing_entry("db_insert_report_summary_fallback", db_insert_report_fallback_start))
            except Exception as e:
                print(f"FAILED TO SAVE REPORT: {e}")
        timings.append(_timing_entry("request_total", request_start))
        telemetry = _build_telemetry(timings)
        print(f"[ASK TRACE] session={session_id} telemetry={json.dumps(telemetry, default=str)}")
        return {"type": "diagnosis", "content": report_json, "telemetry": telemetry}
    else:
        timings.append(_timing_entry("diagnosis_readiness_check", readiness_start))

    # Normal question
    next_question_start = perf_counter()
    next_q = get_next_question(ai_state["symptoms"], ai_state["conversation_history"])
    timings.append(_timing_entry("next_question_generation", next_question_start))
    ai_state["conversation_history"].append(next_q)

    if session_id and len(session_id) == 24:
        try:
            bubbles = [b.strip() for b in next_q.split("---NEXT_BUBBLE---") if b.strip()]
            bot_msgs = [{"role": "bot", "text": b, "timestamp": utcnow()} for b in bubbles]
            db_bot_write_start = perf_counter()
            await db.chat_sessions.update_one(
                {"_id": ObjectId(session_id)},
                {"$push": {"messages": {"$each": bot_msgs}}, "$set": {"updatedAt": utcnow()}}
            )
            timings.append(_timing_entry("db_save_bot_question", db_bot_write_start))
        except Exception:
            pass

    timings.append(_timing_entry("request_total", request_start))
    telemetry = _build_telemetry(timings)
    print(f"[ASK TRACE] session={session_id} telemetry={json.dumps(telemetry, default=str)}")
    return {
        "type": "question",
        "content": next_q,
        "intelligence": {
            "symptoms": ai_state["symptoms"],
            "prakriti": ai_state.get("prakriti", "Evaluating..."),
            "progress": len(ai_state["symptoms"]) * 20
        },
        "telemetry": telemetry
    }


# Alias for legacy /chat endpoint
@app.post("/chat")
async def chat(user_id: str = "default_user", data: dict = Body(...)):
    return await ask(user_id, data)


# ─── Save diagnosis explicitly ─────────────────────────────────────────────────

@app.post("/api/chat/diagnosis")
async def save_diagnosis(data: dict = Body(...)):
    """Explicitly save a diagnosis report to a session."""
    session_id = data.get("sessionId")
    diagnosis = data.get("diagnosis", "")
    if not session_id:
        raise HTTPException(status_code=400, detail="sessionId required")

    title = _extract_title(diagnosis)
    try:
        await db.chat_sessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"diagnosis": diagnosis, "title": title, "updatedAt": utcnow()}}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"success": True, "title": title}


# ─── Save recipes ─────────────────────────────────────────────────────────────

@app.post("/api/chat/recipes")
async def save_recipes(data: dict = Body(...)):
    """Save generated recipes text to a session."""
    session_id = data.get("sessionId")
    recipes_text = data.get("recipesText", "")
    if not session_id:
        raise HTTPException(status_code=400, detail="sessionId required")
    try:
        await db.chat_sessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"recipesText": recipes_text, "updatedAt": utcnow()}}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"success": True}


# ─── Recipes generation ────────────────────────────────────────────────────────

@app.post("/recipes")
async def recipes(user_id: str = "default_user", data: dict = Body(...)):
    facts = data.get("facts", [])
    diagnosis = data.get("diagnosis", "")
    patient_info = data.get("patientInfo", {})

    ai_state = ai_sessions.get(user_id, {})
    symptoms = ai_state.get("symptoms", [])

    context_parts = []
    if facts:
        context_parts.append(f"Patient symptoms: {', '.join(facts) if isinstance(facts, list) else facts}")
    if symptoms:
        context_parts.append(f"Extracted symptoms: {', '.join(symptoms)}")
    if diagnosis:
        try:
            if "---REPORT_DATA---" in diagnosis:
                parts = diagnosis.split("---REPORT_DATA---")
                diag_obj = json.loads(parts[-1])
                diag_name = diag_obj.get("diagnosis", {}).get("name", diagnosis)
                context_parts.append(f"Diagnosis: {diag_name}")
                dietary = diag_obj.get("dietaryGuide", {})
                if dietary.get("toConsume"):
                    context_parts.append(f"Recommended foods: {', '.join(dietary['toConsume'][:5])}")
                if dietary.get("toAvoid"):
                    context_parts.append(f"Foods to avoid: {', '.join(dietary['toAvoid'][:5])}")
            else:
                context_parts.append(f"Diagnosis: {diagnosis[:200]}")
        except Exception:
            context_parts.append(f"Diagnosis: {diagnosis[:200]}")
    if patient_info:
        context_parts.append(f"Patient info: {patient_info}")

    context = "\n".join(context_parts)
    prompt = (
        f"You are an Ayurvedic culinary expert. Generate personalized recipes based on:\n\n"
        f"{context}\n\n"
        "Generate 3-4 detailed recipes. Each should include:\n"
        "- Name, Benefits, Ingredients (with quantities as words, e.g. 'half'), "
        "Preparation steps (max 3), When to consume, Precautions.\n"
        "Separate with '---RECIPE---'.\nUse simple, clear language."
    )
    try:
        timings = []
        request_start = perf_counter()
        reset_trace()
        recipe_llm_start = perf_counter()
        recipes_text = send(prompt)
        timings.append(_timing_entry("recipes_generation", recipe_llm_start))
        
        if user_id and len(user_id) == 24:
            try:
                db_recipe_save_start = perf_counter()
                await db.chat_sessions.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": {"recipesText": recipes_text, "updatedAt": utcnow()}}
                )
                timings.append(_timing_entry("db_save_recipes", db_recipe_save_start))
            except Exception:
                pass

        timings.append(_timing_entry("request_total", request_start))
        telemetry = _build_telemetry(timings)
        print(f"[RECIPES TRACE] session={user_id} telemetry={json.dumps(telemetry, default=str)}")
        return {"recipes": recipes_text, "telemetry": telemetry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate recipes: {str(e)}")


# ─── Reset session ─────────────────────────────────────────────────────────────

@app.post("/reset")
async def reset(user_id: str):
    ai_sessions.pop(user_id, None)
    return {"status": "reset"}


# ─── Health / symptoms ─────────────────────────────────────────────────────────

DATA_DIR = os.path.join(os.path.dirname(__file__), 'frontend_data')
SYMPTOM_FILE = os.path.join(DATA_DIR, 'symptoms.json')


def load_symptoms():
    if not os.path.exists(SYMPTOM_FILE):
        return []
    with open(SYMPTOM_FILE, 'r', encoding='utf-8') as fh:
        return json.load(fh)


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.get('/symptoms')
def get_symptoms():
    return load_symptoms()


@app.get('/symptoms/{symptom_id}')
def get_symptom(symptom_id: str):
    for s in load_symptoms():
        if str(s.get('id')) == str(symptom_id):
            return s
    raise HTTPException(status_code=404, detail='Symptom not found')


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _extract_title(diagnosis_text: str) -> str:
    if not diagnosis_text:
        return "New consultation"
    try:
        raw = diagnosis_text.split("---REPORT_DATA---")[-1] if "---REPORT_DATA---" in diagnosis_text else diagnosis_text
        cleaned = raw.replace("```json", "").replace("```", "").strip()
        start, end = cleaned.index("{"), cleaned.rindex("}")
        report = json.loads(cleaned[start:end + 1])
        name = ""
        if isinstance(report.get("reports"), list) and report["reports"]:
            first_report = report["reports"][0]
            if isinstance(first_report, dict):
                report_data = first_report.get("reportData") if isinstance(first_report.get("reportData"), dict) else {}
                diagnosis_value = report_data.get("diagnosis")
                if isinstance(diagnosis_value, dict):
                    name = diagnosis_value.get("name", "")
                elif isinstance(diagnosis_value, str):
                    name = diagnosis_value
        if not name:
            name = report.get("diagnosis", {}).get("name", "")
        if name:
            # First remove anything in parentheses: "Vata (Something)" -> "Vata"
            import re
            name = re.sub(r'\(.*?\)', '', name)
            # Remove asterisks and extra spaces
            name = name.replace("*", "").strip()
            # If after cleanup it contains "with" or multiple parts, take just the first part 
            # to keep it extremely clean for the UI (e.g. "Vata Imbalance with Agni" -> "Vata Imbalance")
            if " with " in name.lower():
                name = name.split(" with ")[0].strip()
            elif " and " in name.lower():
                name = name.split(" and ")[0].strip()
            
            return name if name else "New consultation"
    except Exception:
        pass
    return "New consultation"


def _build_telemetry(timings):
    return {
        "timings": timings,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('api_server:app', host='127.0.0.1', port=8000, reload=True)
