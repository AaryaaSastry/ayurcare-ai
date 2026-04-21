"""
Thin LLM wrapper.

Priority:
1. Google Gemini (GEMINI_API_KEY)
2. OpenAI (OPENAI_API_KEY)
3. Deterministic fallback
"""

import os
import time
from contextvars import ContextVar
from typing import Optional

_trace_var: ContextVar[list] = ContextVar("llm_trace", default=[])


def _local_fallback(prompt: str) -> str:
    return (
        "Thank you for sharing. Could you please tell me a little more about:\n"
        "- When the symptoms started?\n"
        "- What makes them better or worse?\n"
        "- How severe they feel (mild/moderate/severe)?"
    )


def reset_trace() -> None:
    _trace_var.set([])


def get_trace_snapshot() -> list:
    return list(_trace_var.get())


def _append_trace(entry: dict) -> None:
    current = list(_trace_var.get())
    current.append(entry)
    _trace_var.set(current)


def send(prompt: str, max_tokens: int = 256, model: Optional[str] = None) -> str:
    """
    Send prompt to an LLM and return a text reply.
    """
    start = time.perf_counter()

    # ==========================
    # 1️⃣ GEMINI
    # ==========================
    try:
        from google import genai
        from dotenv import load_dotenv
        
        # Ensure .env is loaded from the correct directory
        env_path = os.path.join(os.path.dirname(__file__), '.env')
        load_dotenv(dotenv_path=env_path)
        
        gem_key = os.getenv("GEMINI_API_KEY")
        configured_model = os.getenv("model")

        if gem_key:
            client = genai.Client(api_key=gem_key)
            
            # Use model from .env if available, else fallback
            model_name = model or configured_model or "gemini-2.0-flash"

            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )

            if hasattr(response, "text") and response.text:
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                _append_trace({
                    "provider": "gemini",
                    "model": model_name,
                    "latency_ms": elapsed_ms,
                    "prompt_chars": len(prompt),
                    "success": True,
                })
                return response.text.strip()

    except Exception as e:
        print(f"❌ Gemini Error: {str(e)}")
        pass

    # ==========================
    # 2️⃣ OPENAI (fallback)
    # ==========================
    try:
        import openai

        key = os.environ.get("OPENAI_API_KEY")
        if key:
            openai.api_key = key

            model_name = model or "gpt-4o-mini"
            response = openai.ChatCompletion.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a warm Ayurvedic assistant."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=max_tokens,
            )

            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            _append_trace({
                "provider": "openai",
                "model": model_name,
                "latency_ms": elapsed_ms,
                "prompt_chars": len(prompt),
                "success": True,
            })
            return response.choices[0].message["content"].strip()

    except Exception:
        pass

    # ==========================
    # 3️⃣ FINAL FALLBACK
    # ==========================
    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
    _append_trace({
        "provider": "local_fallback",
        "model": "deterministic",
        "latency_ms": elapsed_ms,
        "prompt_chars": len(prompt),
        "success": True,
    })
    return _local_fallback(prompt)
