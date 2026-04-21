# from google import genai
from gemini_client import send
from candidate_engine import get_candidates
from nlp.dosha_scoring import score_sentence
from retrieval_agent import get_semantic_context  # NEW: Vector DB search
from dotenv import load_dotenv
import os
import json
import re
from typing import Dict, List

# Load environment variables from .env file
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

# The client is now handled by gemini_client.py
# client = genai.Client(api_key=api_key)

# Session state
session = {
    "symptoms": [],
    "answers": {},
    "conversation_history": [],
    "diagnosis_complete": False,
    "confirmed_disease": None,
    "reasoning": [],
    "awaiting_final_check": False,
    "question_count": 0,
    "max_questions": 2 # Increased to allow deeper clinical flows
}

PRESET_TOPICS = {
    "persistent digestion issues",
    "sleep cycle analysis",
    "seasonal allergy care",
    "energy & stress management",
    "energy and stress management",
}

BASIC_DETAIL_KEYWORDS = [
    "age",
    "gender",
    "height",
    "weight",
    "years old",
    "yo",
    "male",
    "female",
    "cm",
    "kg",
]


SYSTEM_KEYWORDS = {
    "Cardiology": ["heart", "cardiac", "chest pain", "palpitation", "hypertension", "blood pressure"],
    "Pulmonology": ["lung", "breath", "asthma", "cough", "wheezing", "shortness of breath", "respiratory"],
    "Gastroenterology": ["stomach", "acid", "reflux", "gastric", "abdomen", "diarrhea", "constipation", "digestion", "liver"],
    "Neurology": ["headache", "migraine", "seizure", "nerve", "neuropathy", "vertigo", "numbness", "stroke"],
    "Dermatology": ["skin", "rash", "eczema", "psoriasis", "acne", "itching", "lesion"],
    "Orthopedics": ["joint", "bone", "back pain", "knee", "shoulder", "fracture", "spine", "arthritis"],
    "Rheumatology": ["autoimmune", "rheumatoid", "lupus", "inflammation", "joint swelling"],
    "Nephrology": ["kidney", "renal", "creatinine", "proteinuria"],
    "Urology": ["urinary", "urine", "prostate", "stone", "dysuria", "bladder"],
    "Endocrinology": ["thyroid", "diabetes", "hormone", "insulin", "metabolic"],
    "Gynecology": ["menstrual", "pcos", "pregnancy", "uterus", "ovary", "vaginal"],
    "ENT": ["ear", "nose", "throat", "sinus", "tonsil", "hearing", "tinnitus"],
    "Ophthalmology": ["eye", "vision", "blurred vision", "retina", "conjunctivitis"],
    "Psychiatry": ["anxiety", "depression", "panic", "mood", "sleep disorder", "stress"],
}


SPECIALTY_ALIASES = {
    "Cardiology": ["cardiology", "cardiologist", "heart"],
    "Pulmonology": ["pulmonology", "pulmonologist", "respiratory", "chest"],
    "Gastroenterology": ["gastroenterology", "gastro", "digestive", "hepatology"],
    "Neurology": ["neurology", "neurologist", "neuro"],
    "Dermatology": ["dermatology", "dermatologist", "skin"],
    "Orthopedics": ["orthopedic", "orthopaedic", "ortho", "musculoskeletal"],
    "Rheumatology": ["rheumatology", "rheumatologist"],
    "Nephrology": ["nephrology", "nephrologist", "renal", "kidney"],
    "Urology": ["urology", "urologist", "urinary"],
    "Endocrinology": ["endocrinology", "endocrinologist", "diabetes", "thyroid"],
    "Gynecology": ["gynecology", "gynaecology", "obgyn", "obstetrics", "women"],
    "ENT": ["ent", "otolaryngology", "ear", "nose", "throat"],
    "Ophthalmology": ["ophthalmology", "ophthalmologist", "eye"],
    "Psychiatry": ["psychiatry", "psychiatrist", "mental", "behavioral"],
}


SUPPORTIVE_HINTS = [
    "general consultation",
    "general medicine",
    "internal medicine",
    "family medicine",
    "ayurveda",
    "nutrition",
    "diet",
    "yoga",
    "wellness",
    "lifestyle",
    "panchakarma",
    "counselling",
]


def _normalize_text(value):
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def _case_text(disease_name, symptoms):
    symptom_text = ""
    if isinstance(symptoms, list):
        symptom_text = " ".join(str(s) for s in symptoms if s)
    elif isinstance(symptoms, str):
        symptom_text = symptoms
    return f"{_normalize_text(disease_name)} {_normalize_text(symptom_text)}".strip()


def _detect_primary_system(case_text):
    best_system = None
    best_score = 0
    tie = False
    for system_name, keywords in SYSTEM_KEYWORDS.items():
        score = sum(1 for k in keywords if k in case_text)
        if score > best_score:
            best_system = system_name
            best_score = score
            tie = False
        elif score == best_score and score > 0:
            tie = True
    if tie or best_score == 0:
        return None
    return best_system


def _score_specialty(specialty_name, case_text, primary_system):
    spec = _normalize_text(specialty_name)
    score = 0.0

    for token in re.findall(r"[a-z0-9]+", case_text):
        if len(token) > 3 and token in spec:
            score += 0.03

    if "general consultation" in spec:
        score = max(score, 0.35)
    elif "general" in spec and ("medicine" in spec or "physician" in spec):
        score = max(score, 0.34)

    if primary_system:
        aliases = SPECIALTY_ALIASES.get(primary_system, [])
        if any(alias in spec for alias in aliases):
            score += 0.55

    if any(hint in spec for hint in SUPPORTIVE_HINTS):
        score += 0.12

    return min(round(score, 2), 0.99)


def recommend_specialties_for_case(disease_name, symptoms, available_specialties) -> Dict[str, List[Dict]]:
    """Return top ranked specialties with a single optional primary match."""
    available = []
    seen = set()
    for item in (available_specialties or []):
        name = str(item or "").strip()
        if not name:
            continue
        key = _normalize_text(name)
        if key in seen:
            continue
        seen.add(key)
        available.append(name)

    if not any(_normalize_text(x) == "general consultation" for x in available):
        available.append("General Consultation")

    case_text = _case_text(disease_name, symptoms)
    primary_system = _detect_primary_system(case_text)

    scored = []
    for spec in available:
        score = _score_specialty(spec, case_text, primary_system)
        scored.append({"name": spec, "score": score, "isPrimary": False})

    primary_idx = None
    if primary_system:
        aliases = SPECIALTY_ALIASES.get(primary_system, [])
        best = -1.0
        for idx, item in enumerate(scored):
            spec = _normalize_text(item["name"])
            if any(alias in spec for alias in aliases):
                if item["score"] > best:
                    best = item["score"]
                    primary_idx = idx

    if primary_idx is not None:
        scored[primary_idx]["isPrimary"] = True
        scored[primary_idx]["score"] = min(1.0, max(0.75, scored[primary_idx]["score"] + 0.2))

    def _sort_key(item):
        return (1 if item["isPrimary"] else 0, item["score"])

    scored.sort(key=_sort_key, reverse=True)

    selected = []
    for item in scored:
        if len(selected) >= 4:
            break
        spec_name = _normalize_text(item["name"])
        is_general = spec_name == "general consultation"
        if item["score"] >= 0.18 or item["isPrimary"] or is_general:
            selected.append(item)

    if not any(_normalize_text(x["name"]) == "general consultation" for x in selected):
        general_item = next((x for x in scored if _normalize_text(x["name"]) == "general consultation"), None)
        if general_item:
            selected.append(general_item)

    idx = 0
    while len(selected) < 4 and idx < len(scored):
        candidate = scored[idx]
        if not any(_normalize_text(x["name"]) == _normalize_text(candidate["name"]) for x in selected):
            selected.append(candidate)
        idx += 1

    selected = selected[:4]
    selected.sort(key=_sort_key, reverse=True)

    # Enforce one-primary rule
    primary_found = False
    for item in selected:
        if item["isPrimary"] and not primary_found:
            primary_found = True
            continue
        item["isPrimary"] = False

    return {"top_specialties": selected}


def _has_basic_details(history):
    for item in history:
        if not isinstance(item, str):
            continue
        if not item.startswith("User:"):
            continue
        text = item.replace("User:", "").strip().lower()
        if any(k in text for k in BASIC_DETAIL_KEYWORDS):
            return True
    return False


def _normalize_user_text(text):
    return " ".join(text.strip().lower().split())


def _first_user_issue(history):
    for item in history:
        if isinstance(item, str) and item.startswith("User:"):
            return item.replace("User:", "").strip()
    return ""


def _extract_json_object(text):
    if not text:
        return None
    cleaned = text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            return None
    return None


def _extract_patient_info_from_history(history, dosha_profile):
    patient_info = {
        "name": "",
        "age": "",
        "gender": "",
        "height": "",
        "weight": "",
        "constitution": dosha_profile.get("dominant", "") if isinstance(dosha_profile, dict) else ""
    }

    pattern_map = {
        "age": r"(\d{1,3})\s*(?:years old|year old|yo|y/o)",
        "height": r"(\d{2,3}\s*(?:cm|centimeters?|ft|feet|in|inch|inches|['\"]))",
        "weight": r"(\d{2,3}\s*(?:kg|kilograms?|lbs?|pounds?))",
    }

    for item in history:
        if not isinstance(item, str) or not item.startswith("User:"):
            continue

        text = item.replace("User:", "").strip()
        lower = text.lower()

        if not patient_info["gender"]:
            if " female" in f" {lower}" or lower.startswith("female"):
                patient_info["gender"] = "Female"
            elif " male" in f" {lower}" or lower.startswith("male"):
                patient_info["gender"] = "Male"

        for key, pattern in pattern_map.items():
            if patient_info[key]:
                continue
            match = re.search(pattern, lower)
            if match:
                patient_info[key] = match.group(1).strip()

        if not patient_info["name"]:
            name_match = re.search(r"(?:name\s*(?:is)?|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)", text)
            if name_match:
                patient_info["name"] = name_match.group(1).strip()

    return patient_info


def _normalize_report_type(report_type):
    aliases = {
        "diagnosis report": "Diagnosis Report",
        "root cause report": "Root Cause Report",
        "lifestyle report": "Lifestyle Report",
        "treatment plan report": "Treatment Plan Report",
        "risk report": "Risk Report",
        "risk & health score report": "Risk Report",
        "comprehensive report": "Comprehensive Report",
    }
    return aliases.get(str(report_type).strip().lower(), report_type)


def _narrative_fallback_report(report_type, title, symptoms, dosha_profile):
    dominant = ""
    if isinstance(dosha_profile, dict):
        dominant = dosha_profile.get("dominant", "")

    if report_type == "Diagnosis Report":
        return {
            "diagnosis": {
                "name": "Ayurvedic Clinical Impression",
                "reasoning": "The presentation suggests a meaningful imbalance that needs a fuller clinical review."
            },
            "clinicalImpression": "The current symptoms suggest an evolving Ayurvedic imbalance rather than a single isolated complaint.",
            "supportingFindings": symptoms[:4],
            "doshaProfile": {
                "vata": dosha_profile.get("vata", 34) if isinstance(dosha_profile, dict) else 34,
                "pitta": dosha_profile.get("pitta", 33) if isinstance(dosha_profile, dict) else 33,
                "kapha": dosha_profile.get("kapha", 33) if isinstance(dosha_profile, dict) else 33,
                "dominant": dominant or "Mixed",
                "interpretation": "This pattern should be interpreted in the context of the full symptom history."
            },
            "threatLevel": "Moderate",
            "symptomsReported": symptoms[:6]
        }

    if report_type == "Root Cause Report":
        return {
            "diseaseFormation": "The imbalance likely developed gradually through repeated strain on digestion, routine, or recovery.",
            "triggerNarrative": "Small daily aggravators appear to have accumulated over time rather than emerging from a single event.",
            "amaEvolution": "Digestive inefficiency may have allowed heaviness and stagnation to build before clearer symptoms appeared.",
            "rootCauseFocus": "Agni disruption with secondary doshic aggravation"
        }

    if report_type == "Lifestyle Report":
        return {
            "morningFlow": "Begin the day slowly, hydrate with warmth, and avoid rushing into screens or heavy food.",
            "workdayFlow": "Keep meals regular, reduce overstimulation, and insert short pauses to settle the system.",
            "eveningFlow": "Transition out of work gently and favor light nourishment and a quieter pace.",
            "sleepRitual": "End the day with reduced stimulation, warmth, and a consistent sleep window.",
            "integrationNote": "Consistency matters more than intensity."
        }

    if report_type == "Treatment Plan Report":
        return {
            "treatmentNarrative": "Treatment should first calm aggravation, support digestion, and then rebuild steadiness.",
            "medicinesAndSupports": "Any herbs or classical formulations should be individualized by a qualified practitioner.",
            "foodApproach": "Favor warm, simple meals that are easy to digest and avoid extremes.",
            "avoidances": "Avoid foods and habits that feel heavy, highly irregular, very cold, or strongly aggravating.",
            "therapyGuidance": "Therapeutic procedures should depend on an in-person assessment.",
            "cautions": "Seek clinician review before starting herbs, especially with other medical conditions or medicines."
        }

    if report_type == "Risk Report":
        return {
            "currentAssessment": "The present picture appears manageable but persistent enough to deserve follow-through.",
            "shortTermOutlook": "Without routine correction, symptoms may continue to recur.",
            "longTermForecast": "Ongoing imbalance can gradually deepen into more entrenched dysfunction.",
            "recoveryExpectation": "Recovery is more favorable when diet, routine, and treatment are followed consistently."
        }

    return {
        "synthesis": "Across the reports, the body appears to be signaling a pattern that links symptoms, routine, and recovery capacity.",
        "mindBodyLink": "Physical discomfort and daily stress likely reinforce one another.",
        "finalClarity": "A steady routine and individualized Ayurvedic guidance remain the clearest path forward."
    }


def _generate_specialist_report(report_type, title, persona, objective, schema, style_rules, shared_context, symptoms, dosha_profile):
    prompt = (
        "You are writing ONE section of an Ayurvedic clinical dossier.\n"
        f"Specialist role: {persona}\n"
        f"Report type: {report_type}\n"
        f"Section title: {title}\n"
        f"Primary objective: {objective}\n\n"
        f"{shared_context}\n\n"
        "WRITING RULES:\n"
        "- Write this as an independent specialist pass, not as part of a master template.\n"
        "- Do not use tables, matrices, scorecards, or checklist formatting inside the prose.\n"
        "- Do not sound repetitive or generic.\n"
        "- Assume other specialists will cover other domains; stay tightly focused on your own lens.\n"
        "- Use natural clinical language and complete sentences.\n"
        "- Avoid Sanskrit overload. Use Ayurvedic terms only when they improve clarity.\n"
        f"{style_rules}\n\n"
        "Return ONLY valid JSON with this exact top-level shape:\n"
        "{\n"
        f'  "reportType": "{report_type}",\n'
        f'  "title": "{title}",\n'
        f'  "reportData": {schema}\n'
        "}\n"
    )

    report_obj = _extract_json_object(send(prompt, max_tokens=900))
    if isinstance(report_obj, dict):
        report_obj["reportType"] = _normalize_report_type(report_obj.get("reportType", report_type))
        report_obj["title"] = report_obj.get("title") or title
        report_data = report_obj.get("reportData")
        if isinstance(report_data, dict):
            return report_obj

    return {
        "reportType": report_type,
        "title": title,
        "reportData": _narrative_fallback_report(report_type, title, symptoms, dosha_profile)
    }

def reset_session():
    """Reset the conversation session."""
    global session
    session = {
        "symptoms": [],
        "answers": {},
        "conversation_history": [],
        "diagnosis_complete": False,
        "confirmed_disease": None,
        "reasoning": [],
        "awaiting_final_check": False,
        "question_count": 0,
        "max_questions": 5
    }

def extract_symptoms_from_text(text):
    """Extract symptoms from user text."""
    try:
        prompt = f"Extract symptoms from the following text. Return them as a comma-separated list of lowercase phrases. If no symptoms are found, return 'NONE'.\n\nText: {text}"
        response_text = send(prompt)
        if response_text and response_text.upper() != 'NONE':
            return [s.strip() for s in response_text.split(',')]
        return []
    except:
        return []


def get_current_dosha_profile(history):
    """Calculate dosha profile from conversation history."""
    all_text = " ".join(history)
    return score_sentence(all_text)

def should_give_diagnosis(symptoms, answers, history):
    """Check if we should give diagnosis now."""
    # Never diagnose during the hard-coded onboarding phase (first 3 bots = history < 7)
    if len(history) < 7:
        return False

    # Force diagnosis after 5-6 AI-lead questions (approx history length 12)
    if len(history) >= 12: 
        return True
        
    try:
        prompt = (
            f"Symptoms: {', '.join(symptoms)}\n"
            f"Answers: {list(answers.values())}\n"
            f"Conversation History: {history}\n\n"
            "Based on the conversation history, do you have enough specific clinical information "
            "(duration, quality, aggravating/relieving factors) to provide a definitive Ayurvedic "
            "diagnosis and a professional medical report?\n"
            "If yes, return YES. If no, return NO."
        )
        response_text = send(prompt)
        return "YES" in response_text.upper()
    except:
        return False


def get_next_question(symptoms, history):
    """Generate next question based on current symptoms and knowledge base."""
    # Logic for hard-coded phase (History length tracks User: and Bot: messages)
    
    # 1. Greeting & Basic Details (Initial Bot Message - triggered by 'START_CONVERSATION')
    if len(history) == 0:
        return (
            "Namaste! I am your Ayurvedic AI assistant. I am here to help you understand your health through the wisdom of Ayurveda. Let's begin by getting to know you better.---NEXT_BUBBLE---"
            "To provide an accurate assessment, could you please share your basic details? I need your Name, Age, Gender, Height, Weight, and any major lifestyle factors (like diet or sleep patterns)."
        )

    # NEW: Move this UP so it catches the very first user message before detail checking
    # 3. If user directly initiates the chat with a symptom block (e.g. they clicked a frontend suggestion)
    if len(history) == 1:
        user_first_msg = history[0].replace("User: ", "")
        prompt = (
            f"The user just started the consultation by stating: '{user_first_msg}'\n"
            "You are 'Doc AI', a compassionate Ayurvedic assistant. Respond with high empathy.\n"
            "Generate a response that does THREE things:\n"
            "1. Start with a variation of: 'Hello. Iâ€™m truly sorry to hear youâ€™re experiencing [the user's specific issue] â€“ that can be very uncomfortable.'\n"
            "2. Asks ONE brief follow-up question perfectly tailored to their issue to get them to explain the specific difficulty (e.g., 'To understand better, could you describe what specifically feels difficult with your digestion?').\n"
            "3. Before proceeding, asks the user to provide their basic details: Name, age, gender, height, weight, typical diet & daily activity level.\n"
            "Keep the response professional, compassionate, and natural. Maximum 60 words."
        )
        return send(prompt)

    # 2. Q&A MODE AFTER DIAGNOSIS (Move this checking down so it doesn't catch empty history)
    if any("---REPORT_DATA---" in str(h) for h in history):
        # Find the report content for context
        report_content = next((h for h in reversed(history) if "---REPORT_DATA---" in str(h)), "")
        
        prompt = (
            f"You are an Ayurvedic AI assistant. The user has already received their diagnosis report.\n"
            f"Diagnosis Report Context: {report_content}\n"
            f"Recent Conversation context: {history[-5:]}\n"
            f"User Question: {history[-1]}\n\n"
            "Answer the question based on the report and Ayurvedic principles. "
            "Be compassionate, clear, and concise (3-5 lines). "
            "If the user asks 'will I die?' or similar life-threatening questions, "
            "reassure them while emphasizing the importance of following the treatments and consulting the recommended doctors. "
            "Do not prescribe new specific medications, but you can explain the logic behind the suggested treatments in the report."
        )
        return send(prompt)

    # Always ask for basic details first if missing
    if not _has_basic_details(history):
        if len(history) >= 1:
            last_user = next((h for h in reversed(history) if isinstance(h, str) and h.startswith("User:")), "")
            user_text = _normalize_user_text(last_user.replace("User:", ""))
            if user_text in PRESET_TOPICS:
                return (
                    "I understand this can feel uncomfortable."
                    " Please share your basic details: Name, Age, Gender, Height, Weight, and any major lifestyle factors (diet, sleep, activity)."
                )

        return (
            "I understand this can be difficult."
            " Please share your basic details: Name, Age, Gender, Height, Weight, and any major lifestyle factors (diet, sleep, activity)."
        )

    # 2. Main Issue (after user gives details via legacy flow)
    if len(history) == 2:
        return "Thank you. Now, please describe exactly what health issue or symptoms you are experiencing today in as much detail as possible."

    # --- AI INVOLVED AFTER THIS POINT ---
    
    # Safety Check: If we somehow get here after 12 messages (adjusting for hard-coded phase), force a summary
    if len(history) >= 12:
        return "I have gathered enough information. Please type 'diagnose' to see your medical report."

    dosha_profile = get_current_dosha_profile(history)
    candidates = get_candidates(symptoms, dosha_profile=dosha_profile, top_n=2)
    
    context = ""
    if candidates:
        context = "Potentially matching conditions from books:\n"
        for c in candidates:
            # Safely handle record content
            rec = c.get('record', {})
            symptom_text = rec.get('symptoms', '') if isinstance(rec, dict) else ""
            context += f"- {symptom_text}\n"

    primary_issue = _first_user_issue(history)
    prompt = (
        f"Symptoms: {', '.join(symptoms)}\n"
        f"Knowledge Context: {context}\n"
        f"History: {'; '.join(history)}\n\n"
        f"The user's first stated issue: {primary_issue}\n"
        "As 'Doc AI', ask ONE short, specific clinical follow-up question to find the ROOT CAUSE (Ama/Dosha) "
        "and differentiate between potential Ayurvedic conditions. Prioritize asking about one of these at a time:\n"
        "1. TIME: Does it happen at a specific time (morning/afternoon/evening)?\n"
        "2. QUALITIES: Does it feel like burning (Pitta), cramping (Vata), or gas pressure/heaviness (Kapha)?\n"
        "3. RELIEF: Is it better with WARMTH (hot tea, warm bottle) or COLD (ice pack, cold water)?\n"
        "4. TRIGGERS: Does eating spicy, oily, or specific foods trigger it?\n"
        "DO NOT repeat a question already asked in History. Return ONLY the question."
        "Ask only 1 question at a time. Be specific and focused on clinical differentiation."
        "DO NOT USE ANY SANSKRIT TERMS. Use simple, clear language."
    )
    
    response = send(prompt)
    if not response or len(response) < 5:
        return "Can you describe the timing or triggers of these symptoms?"
    return response


def diagnose(symptoms, history):
    """Make diagnosis using retrieved knowledge from books."""
    try:
        # Check history length - if it's very short, add a hint for more detail
        if len(history) < 6:
            return "I need a bit more detail to provide a professional report. Could you tell me more about when this happens or what makes it worse?"

        dosha_profile = get_current_dosha_profile(history)
        candidates = get_candidates(symptoms, dosha_profile=dosha_profile, top_n=3)
        
        # Integrate Vector DB for richer clinical details
        search_query = symptoms + [history[-1]]
        semantic_context = get_semantic_context(search_query, top_k=4)

        kb_context = "REFERENCE KNOWLEDGE FROM AYURVEDIC TEXTS:\n"
        if candidates:
            for c in candidates:
                rec = c['record']
                kb_context += f"Condition: {c.get('id', 'Unknown')}\n"
                kb_context += f"Symptoms described in books: {rec.get('symptoms', 'N/A')}\n"
                kb_context += f"Causes: {rec.get('causes', 'N/A')}\n"
                kb_context += f"Treatments: {rec.get('treatment', 'N/A')}\n\n"
        
        kb_context += "\nDEEP CLINICAL CONTEXT FROM TEXTBOOKS:\n"
        kb_context += semantic_context
        patient_info = _extract_patient_info_from_history(history, dosha_profile)
        primary_issue = _first_user_issue(history)

        shared_context = (
            f"{kb_context}\n\n"
            "USER CASE:\n"
            f"Primary stated issue: {primary_issue}\n"
            f"Current symptoms: {', '.join(symptoms)}\n"
            f"Conversation history: {'; '.join(history)}\n"
            f"Dosha profile from conversation scoring: {json.dumps(dosha_profile)}\n"
            f"Patient info extracted from history: {json.dumps(patient_info)}"
        )

        report_specs = [
            {
                "reportType": "Diagnosis Report",
                "title": "Clinical Diagnosis",
                "persona": "Senior Ayurvedic Physician",
                "objective": "Provide a high-density diagnostic overview with key clinical markers.",
                "schema": "{ \"kpis\": [{\"label\": \"...\", \"value\": \"...\"}], \"pain_points\": [\"...\"], \"diagnosis\": { \"name\": \"...\", \"reasoning\": \"...\" }, \"clinicalImpression\": \"...\", \"supportingFindings\": [\"...\"], \"doshaProfile\": { \"vata\": 0, \"pitta\": 0, \"kapha\": 0, \"dominant\": \"...\", \"interpretation\": \"...\" }, \"threatLevel\": \"Low/Moderate/High\", \"symptomsReported\": [\"...\"] }",
                "style_rules": "- Write ONLY 70-100 words max for the narrative sections.\n- Focus on generating 3-4 professional clinical KPIs (e.g., 'Metabolic Fire Intensity'). KPI values MUST be 1-3 words max (e.g., 'High', 'Severely Diminished').\n- Identify 3-5 specific 'pain_points' for the patient."
            },
            {
                "reportType": "Root Cause Report",
                "title": "Disease Formation Narrative",
                "persona": "Ayurvedic Pathology Expert",
                "objective": "Explain disease formation and holistic guidance.",
                "schema": "{ \"kpis\": [{\"label\": \"...\", \"value\": \"...\"}], \"pain_points\": [\"...\"], \"section1_content\": \"...\", \"section2_title\": \"Holistic guidance and clinical protocol summary\", \"section2_content\": \"...\" }",
                "style_rules": "- section1 title: 'Disease Formation Narrative'.\n- section1 weight: 70-100 words max.\n- section2 weight: 70-100 words max.\n- KPI values MUST be 1-3 words max."
            },
            {
                "reportType": "Lifestyle Report",
                "title": "Daily Rhythm Script",
                "persona": "Ayurvedic Lifestyle Coach",
                "objective": "Provide a daily script and holistic guidance.",
                "schema": "{ \"kpis\": [{\"label\": \"...\", \"value\": \"...\"}], \"pain_points\": [\"...\"], \"section1_content\": \"...\", \"section2_title\": \"Holistic guidance and clinical protocol summary\", \"section2_content\": \"...\" }",
                "style_rules": "- section1 title: 'Daily Rhythm Script'.\n- section1 weight: 70-100 words max.\n- section2 weight: 70-100 words max.\n- KPI values MUST be 1-3 words max."
            },
            {
                "reportType": "Treatment Plan Report",
                "title": "Therapeutic Strategy",
                "persona": "Ayurvedic Pharmacist",
                "objective": "Explain therapeutic strategy and holistic guidance.",
                "schema": "{ \"kpis\": [{\"label\": \"...\", \"value\": \"...\"}], \"pain_points\": [\"...\"], \"section1_content\": \"...\", \"section2_title\": \"Holistic guidance and clinical protocol summary\", \"section2_content\": \"...\" }",
                "style_rules": "- section1 title: 'Therapeutic Strategy'.\n- section1 weight: 70-100 words max.\n- section2 weight: 70-100 words max.\n- KPI values MUST be 1-3 words max."
            },
            {
                "reportType": "Risk Report",
                "title": "Clinical Forecast",
                "persona": "Clinical Prognosticator",
                "objective": "Describe forecast and holistic guidance.",
                "schema": "{ \"kpis\": [{\"label\": \"...\", \"value\": \"...\"}], \"pain_points\": [\"...\"], \"section1_content\": \"...\", \"section2_title\": \"Holistic guidance and clinical protocol summary\", \"section2_content\": \"...\" }",
                "style_rules": "- section1 title: 'Clinical Forecast'.\n- section1 weight: 70-100 words max.\n- section2 weight: 70-100 words max.\n- KPI values MUST be 1-3 words max."
            },
            {
                "reportType": "Comprehensive Report",
                "title": "Integrated Synthesis",
                "persona": "Chief Medical Synthesizer",
                "objective": "Provide synthesis and holistic guidance.",
                "schema": "{ \"kpis\": [{\"label\": \"...\", \"value\": \"...\"}], \"pain_points\": [\"...\"], \"section1_content\": \"...\", \"section2_title\": \"Holistic guidance and clinical protocol\", \"section2_content\": \"...\" }",
                "style_rules": "- section1 title: 'Integrated Synthesis'.\n- section1 weight: 70-100 words max.\n- section2 weight: 70-100 words max.\n- KPI values MUST be 1-3 words max."
            }
        ]

        reports = [
            _generate_specialist_report(
                spec["reportType"],
                spec["title"],
                spec["persona"],
                spec["objective"],
                spec["schema"],
                spec["style_rules"],
                shared_context,
                symptoms,
                dosha_profile,
            )
            for spec in report_specs
        ]

        diagnosis_data = reports[0].get("reportData", {}) if reports else {}
        chat_summary_prompt = (
            "You are Doc AI, an expert Ayurvedic clinician.\n"
            "Write a compassionate but professional 3-4 sentence summary for chat.\n"
            "Mention the leading Ayurvedic impression and one short reasoning thread.\n"
            "Do not mention JSON or sections.\n\n"
            f"Patient info: {json.dumps(patient_info)}\n"
            f"Diagnosis report: {json.dumps(diagnosis_data)}\n"
        )
        chat_summary = send(chat_summary_prompt, max_tokens=220)

        payload = {
            "patientInfo": patient_info,
            "reports": reports
        }
        return f"{chat_summary}\n---REPORT_DATA---\n{json.dumps(payload, ensure_ascii=False)}"
    except:
        return None

def search_disease_in_file(disease):
    """Search database for remedies."""
    downloads = os.path.join(os.path.expanduser("~"), "Downloads")
    file_path = os.path.join(downloads, "Ayurvedic_merged.txt")
    
    if not os.path.exists(file_path):
        return []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        matches = []
        for line in lines:
            if disease.lower() in line.lower():
                matches.append(line.rstrip())
        return matches[:15]
    except:
        return []

def extract_answer_info(question, answer):
    """Extract key info."""
    try:
        prompt = f"Question: {question}\nAnswer: {answer}\nSummarize the answer's key point in 4 words or less."
        return send(prompt)
    except:
        return answer[:30]


def present_diagnosis(diagnosis_text):
    """Display diagnosis including book treatments."""
    lines = diagnosis_text.split('\n')
    disease = confidence = reasoning = treatment = ""
    
    for line in lines:
        if line.startswith("DISEASE:"):
            disease = line.replace("DISEASE:", "").strip()
        elif line.startswith("CONFIDENCE:"):
            confidence = line.replace("CONFIDENCE:", "").strip()
        elif line.startswith("REASONING:"):
            reasoning = line.replace("REASONING:", "").strip()
        elif line.startswith("TREATMENT:"):
            treatment = line.replace("TREATMENT:", "").strip()
    
    print("\n" + "=" * 55)
    print(f"ðŸ¥ DIAGNOSIS: {disease.upper()}")
    print(f"ðŸ“Š Confidence: {confidence}%")
    print("=" * 55)
    print(f"\nðŸ’¡ Reasoning: {reasoning}")
    
    if treatment:
        print(f"\nðŸ“š AYURVEDIC TREATMENT (from book text):")
        print("-" * 40)
        print(f"  {treatment}")
        print("-" * 40)

if __name__ == "__main__":
    # Welcome
    print("=" * 55)
    print("ðŸ©º AYURVEDIC SYMPTOM CHECKER")
    print("=" * 55)
    print("Describe your symptoms. I'll ask key questions.\n")

    while True:
        user_input = input("You: ")
        
        if user_input.lower() in ['exit', 'quit']:
            print("Goodbye!")
            break
        
        if user_input.lower() == 'reset':
            reset_session()
            print("âœ… Reset. Start describing.\n")
            continue
        
        if session["diagnosis_complete"]:
            disease = session["confirmed_disease"]
            prompt = f"User asked a question about their confirmed diagnosis {disease}. Answer using Ayurvedic principles and general knowledge.\nQuestion: {user_input}\nAnswer:"
            response_text = send(prompt)
            print(f"\nAI: {response_text}\n")
            continue
        
        # Handle final check answer
        if session["awaiting_final_check"]:
            print("\nðŸ” Finalizing assessment using book data...\n")
            diagnosis = diagnose(session["symptoms"], session["conversation_history"])
            if diagnosis and "DISEASE:" in diagnosis:
                present_diagnosis(diagnosis)
                session["diagnosis_complete"] = True
                session["confirmed_disease"] = diagnosis.split("DISEASE:")[1].split("\n")[0].strip()
            else:
                print("Sorry, I could not finalize a diagnosis. Please try again or provide more details.")
            continue

        # Process user input and update history
        session["conversation_history"].append(f"User: {user_input}")

        # NEW: Initial symptom extraction or adding more symptoms
        extracted = extract_symptoms_from_text(user_input)
    if extracted:
        session["symptoms"].extend(extracted)
        session["symptoms"] = list(set(session["symptoms"])) # Unique
    
    # Generate reasoning/answer summary for history logic
    if session["question_count"] > 0:
        last_q = next(reversed([q for q in session["conversation_history"] if not q.startswith("User:") and not q.startswith("Answer:") and not q.startswith("AI:")]), "Previous Question")
        summary = extract_answer_info(last_q, user_input)
        session["answers"][last_q] = summary

    # Check if we should diagnose or ask more
    if should_give_diagnosis(session["symptoms"], session["answers"], session["conversation_history"]):
        session["awaiting_final_check"] = True
        print("\nAI: I have a potential diagnosis in mind based on the books. Shall I proceed? (Yes/No)")
    elif session["question_count"] >= session["max_questions"]:
        session["awaiting_final_check"] = True
        print("\nAI: I've good amount of information. Shall I provide a diagnosis based on the books? (Yes/No)")
    else:
        next_q = get_next_question(session["symptoms"], session["conversation_history"])
        session["conversation_history"].append(f"AI: {next_q}")
        session["question_count"] += 1
        print(f"\nAI: {next_q}\n")

