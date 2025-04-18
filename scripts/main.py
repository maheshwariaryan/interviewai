# ✅ main.py with per-user session isolation
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uuid
import re
import io
from PyPDF2 import PdfReader
from evaluator import InterviewEvaluator
from questions_generator import interview_candidate
from resume_parser import extract_details as extract_resume_details

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global session store
user_sessions = {}

class ResponseModel(BaseModel):
    response: str

class ResumeContent(BaseModel):
    content: str

class InterviewConfigModel(BaseModel):
    role: str
    skills: Optional[str] = None
    experience: Optional[str] = None
    education: Optional[str] = None

@app.post("/api/upload-resume")
async def upload_resume(resume: UploadFile = File(...), role: str = Form(...)):
    try:
        contents = await resume.read()
        reader = PdfReader(io.BytesIO(contents))
        text = "\n".join(page.extract_text() for page in reader.pages if page.extract_text())

        resume_details = await extract_resume_details(ResumeContent(content=text))

        simplified_resume = f"""
Skills:
{resume_details.get("skills", "")}

Experience:
{resume_details.get("experience", "")}

Education:
{resume_details.get("education", "")}
"""

        questions_text = interview_candidate(
            resume=simplified_resume,
            role=role,
            skills=resume_details.get("skills", ""),
            experience=resume_details.get("experience", ""),
            education=resume_details.get("education", "")
        )

        questions = extract_questions(questions_text)
        session_id = str(uuid.uuid4())

        user_sessions[session_id] = {
            "questions": questions,
            "index": 0,
            "responses": [],
            "context": {"role": role, "resume_data": text},
            "evaluator": None
        }

        return {
            "success": True,
            "session_id": session_id,
            "question_count": len(questions)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing resume: {str(e)}")

@app.get("/api/get-question")
async def get_question(session_id: str = Query(...)):
    session = user_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    questions = session["questions"]
    index = session["index"]

    if not questions or index >= len(questions):
        return {"question": "No questions available. Please generate questions first.", "remaining": 0}

    question = questions[index]
    return {
        "question": question,
        "remaining": len(questions) - index - 1,
        "question_index": index,
        "question_type": "unknown"
    }

@app.post("/api/submit-response")
async def submit_response(user_response: ResponseModel, session_id: str = Query(...)):
    session = user_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    index = session["index"]
    questions = session["questions"]
    if index >= len(questions):
        raise HTTPException(status_code=400, detail="No more questions")

    question = questions[index]
    if not session["evaluator"]:
        session["evaluator"] = InterviewEvaluator(
            role=session["context"].get("role", ""),
            resume_data=session["context"].get("resume_data", None)
        )

    evaluation = session["evaluator"].evaluate_response(question, user_response.response, session["context"])
    session["responses"].append({
        "question": question,
        "answer": user_response.response,
        "evaluation": evaluation,
        "question_type": session["evaluator"]._analyze_question_type(question)
    })
    session["index"] += 1

    return {
        "evaluation": evaluation,
        "question_index": index,
        "total_questions": len(questions),
        "interview_complete": session["index"] >= len(questions)
    }

@app.get("/api/get-results")
async def get_results(session_id: str = Query(...)):
    session = user_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    responses = session["responses"]
    total_score = sum(float(r["evaluation"]) for r in responses if r["evaluation"].replace('.', '', 1).isdigit())
    average_score = total_score / len(responses) if responses else 0

    return {
        "responses": responses,
        "total_questions": len(session["questions"]),
        "answered_questions": len(responses),
        "average_score": round(average_score, 1),
    }

def extract_questions(text):
    standard = re.findall(r'Question\s+\d+:\s*(.+?)(?=\s*Question\s+\d+:|$)', text, re.DOTALL)
    if standard:
        return [q.strip() for q in standard if q.strip()]
    numbered = re.findall(r'\d+\.\s*(.+?)(?=\s*\d+\.|$)', text, re.DOTALL)
    return [q.strip() for q in numbered if q.strip()] if numbered else []

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
