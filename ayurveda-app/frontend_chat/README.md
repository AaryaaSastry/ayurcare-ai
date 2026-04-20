# frontend_chat

Simple React (Vite) frontend for the `bot-brain` `run_cross_query.py` FastAPI backend.

Quick start:

1. cd to the folder and install dependencies:

```bash
cd "frontend_chat"
npm install
```

2. Run dev server:

```bash
npm run dev
```

3. Ensure the backend `run_cross_query.py` FastAPI server is running at `http://127.0.0.1:8000`.

Usage:
- Type your main concern and press Send. The frontend sends facts to `/ask` and displays the assistant question.
- If the assistant asks a question (ends with `?`), type your answer and press Send — it will be recorded as a `Q: ... A: ...` fact.
-- The frontend sends facts to `/ask` and displays the assistant question. Use Send to continue the conversation.
