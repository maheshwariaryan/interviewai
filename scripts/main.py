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

# ✅ CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://interviewai-bay.vercel.app"],  # 🚫 no trailing slash!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Session store
user_sessions = {}

class ResumeContent(BaseModel):
    content: str

class ResponseModel(BaseModel):
    response: str

@app.get("/")
def health():
    return {"status": "running"}

@app.post("/api/upload-resume")
async def upload_resume(resume: UploadFile = File(...), role: str = Form(...)):
    try:
        contents = await resume.read()
        reader = PdfReader(io.BytesIO(contents))
        text = "\n".join(page.extract_text() for page in reader.pages if page.extract_text())

        resume_details = await extract_resume_details(ResumeContent(content=text))
        simplified_resume = f"""
Skills:\n{resume_details.get("skills", "")}\n
Experience:\n{resume_details.get("experience", "")}\n
Education:\n{resume_details.get("education", "")}
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
        print(f"UPLOAD ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/api/get-question")
async def get_question(session_id: str):
    session = user_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    index = session["index"]
    questions = session["questions"]
    if index >= len(questions):
        return {"question": "No questions available.", "remaining": 0}

    return {
        "question": questions[index],
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
            role=session["context"]["role"],
            resume_data=session["context"]["resume_data"]
        )

    evaluator = session["evaluator"]
    score = evaluator.evaluate_response(question, user_response.response, session["context"])
    q_type = evaluator._analyze_question_type(question)

    session["responses"].append({
        "question": question,
        "answer": user_response.response,
        "evaluation": score,
        "question_type": q_type
    })
    session["index"] += 1

    return {
        "evaluation": score,
        "question_type": q_type,
        "question_index": index,
        "total_questions": len(questions),
        "interview_complete": session["index"] >= len(questions)
    }

@app.get("/api/get-results")
async def get_results(session_id: str):
    session = user_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    responses = session["responses"]
    total_score = sum(float(r["evaluation"]) for r in responses)
    avg_score = total_score / len(responses) if responses else 0

    return {
        "responses": responses,
        "total_questions": len(session["questions"]),
        "answered_questions": len(responses),
        "average_score": round(avg_score, 1)
    }

def extract_questions(text):
    standard = re.findall(r'Question\\s+\\d+:\\s*(.+?)(?=\\s*Question\\s+\\d+:|$)', text, re.DOTALL)
    if standard:
        return [q.strip() for q in standard if q.strip()]
    numbered = re.findall(r'\\d+\\.\\s*(.+?)(?=\\s*\\d+\\.|$)', text, re.DOTALL)
    return [q.strip() for q in numbered if q.strip()] if numbered else []
    
if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
