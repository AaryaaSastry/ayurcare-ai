import os
import json
from datetime import datetime
from google import genai
from dotenv import load_dotenv

# Shared trace for telemetry
_llm_trace = []

def reset_trace():
    global _llm_trace
    _llm_trace = []

def get_trace_snapshot():
    return list(_llm_trace)

def _log_raw_response(prompt, response_text):
    """Debug helper to see exactly what the AI is returning."""
    try:
        log_dir = os.path.join(os.path.dirname(__file__), "logs")
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        log_file = os.path.join(log_dir, f"ai_response_{timestamp}.log")
        
        with open(log_file, "w", encoding="utf-8") as f:
            f.write("=== PROMPT ===\n")
            f.write(prompt)
            f.write("\n\n=== RESPONSE ===\n")
            f.write(response_text)
    except Exception as e:
        print(f"Failed to log raw response: {e}")

def send(prompt, model=None, max_tokens=1024):
    """
    Unified send function.
    Tries Google Gemini first, then OpenAI if available.
    """
    from time import perf_counter
    start_time = perf_counter()
    
    _local_fallback = "Thank you for sharing. Could you please tell me a little more about: When the symptoms started? What makes them better or worse? How severe they feel (mild/moderate/severe)?"
    
    import time

    def _is_rate_limit_error(err_str):
        lowered = err_str.lower()
        return "429" in err_str or "resource_exhausted" in lowered or "quota" in lowered

    def _is_model_error(err_str):
        lowered = err_str.lower()
        return "not found" in lowered or "unsupported" in lowered or "invalid_argument" in lowered

    # Ensure .env is loaded from the correct directory
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(dotenv_path=env_path, override=True)

    gem_key = os.getenv("GEMINI_API_KEY")
    configured_model = os.getenv("model")

    if gem_key:
        client = genai.Client(api_key=gem_key)

        primary_model = model or configured_model or "gemma-4-26b-a4b-it"
        model_chain = [
            primary_model,
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
        ]

        seen_models = set()
        ordered_models = []
        for model_name in model_chain:
            if model_name and model_name not in seen_models:
                ordered_models.append(model_name)
                seen_models.add(model_name)

        # Explicitly disable safety filters for clinical technical analysis
        safety_settings = [
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]

        for model_name in ordered_models:
            retry_delay = 1
            for attempt in range(3):
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config={
                            'safety_settings': safety_settings,
                            'temperature': 0.1,
                            'max_output_tokens': max_tokens
                        }
                    )

                    if hasattr(response, "text") and response.text:
                        res_text = response.text
                        _log_raw_response(prompt, res_text) # LOG FOR DEBUGGING

                        _llm_trace.append({
                            "model": model_name,
                            "latency_ms": round((perf_counter() - start_time) * 1000, 2),
                            "status": "success"
                        })
                        return res_text

                    print(f"⚠️ Gemini returned empty or blocked response. Model: {model_name}")
                    if hasattr(response, "candidates") and response.candidates:
                        print(f"   Finish Reason: {response.candidates[0].finish_reason}")
                    break

                except Exception as e:
                    err_str = str(e)
                    if _is_rate_limit_error(err_str):
                        if attempt < 2:
                            print(f"🔄 Rate limit hit on {model_name}. Retrying in {retry_delay}s... (Attempt {attempt+1}/3)")
                            time.sleep(retry_delay)
                            retry_delay *= 2
                            continue

                        print(f"⚠️ Quota exhausted for {model_name}, trying next fallback model.")
                        break

                    if _is_model_error(err_str):
                        print(f"⚠️ Model unavailable: {model_name}. Trying next fallback model.")
                        break

                    print(f"❌ Gemini Error during send(): {type(e).__name__}: {err_str}")
                    break
    
    return _local_fallback
