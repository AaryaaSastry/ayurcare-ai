import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
print(f"API Key found: {api_key}")

try:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemma-3-27b-it",
        contents="Hello, say 'API WORKING' if you receive this.",
    )
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
