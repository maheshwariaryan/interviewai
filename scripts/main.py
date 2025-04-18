# main.py
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import re
import io
from PyPDF2 import PdfReader
from evaluator import InterviewEvaluator
from questions_generator import interview_candidate
from resume_parser import extract_details as extract_resume_details

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://interviewai-bay.vercel.app",  # ✅ correct (no slash)
        "http://localhost:3000"  # optional for local dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global interview state
interview_questions = []
current_question_index = 0
interview_responses = []
current_interview_context = {"role": "", "resume_data": None}
evaluator = None

# 📄 Models
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
        # Read PDF content
        contents = await resume.read()
        reader = PdfReader(io.BytesIO(contents))
        text = "\n".join(page.extract_text() for page in reader.pages if page.extract_text())

        # Save to global context
        current_interview_context["role"] = role
        current_interview_context["resume_data"] = text

        # Step 1: Extract structured fields
        resume_details = await extract_resume_details(ResumeContent(content=text))

        # Step 2: Generate questions from parsed content
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

        # Step 3: Store questions
        global interview_questions, current_question_index, interview_responses
        interview_questions = extract_questions(questions_text)
        current_question_index = 0
        interview_responses.clear()

        return {
            "success": True,
            "role": role,
            "question_count": len(interview_questions),
            "questions": interview_questions
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing resume: {str(e)}")

# 📑 Extract structured details
@app.post("/api/extract-resume")
async def extract_resume(resume_data: ResumeContent):
    try:
        return await extract_resume_details(resume_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting resume details: {str(e)}")

# ❓ Generate interview questions
@app.post("/api/generate-questions")
async def generate_questions(config: InterviewConfigModel):
    global interview_questions, current_question_index

    try:
        simplified_resume = f"""
Skills:
{config.skills or ""}

Experience:
{config.experience or ""}

Education:
{config.education or ""}
""" if (config.skills or config.experience or config.education) else config.resume or ""

        questions_text = interview_candidate(
            resume=simplified_resume,
            role=config.role,
            skills=config.skills or "",
            experience=config.experience or "",
            education=config.education or ""
        )

        interview_questions = extract_questions(questions_text)
        current_question_index = 0
        interview_responses.clear()

        return {"total_questions": len(interview_questions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating questions: {str(e)}")

# 🔄 Get next question
@app.get("/api/get-question")
async def get_question():
    global current_question_index, interview_questions

    if not interview_questions or current_question_index >= len(interview_questions):
        return {"question": "No questions available. Please generate questions first.", "remaining": 0}

    question = interview_questions[current_question_index]
    remaining = len(interview_questions) - current_question_index - 1
    question_type = evaluator._analyze_question_type(question) if evaluator else "unknown"

    return {
        "question": question,
        "remaining": remaining,
        "question_type": question_type,
        "question_index": current_question_index
    }

# 📝 Submit answer
@app.post("/api/submit-response")
async def submit_response(user_response: ResponseModel):
    global current_question_index, interview_questions, interview_responses, evaluator

    if not interview_questions or current_question_index >= len(interview_questions):
        raise HTTPException(status_code=400, detail="No active question to respond to")

    try:
        current_question = interview_questions[current_question_index]

        if not evaluator:
            evaluator = InterviewEvaluator(
                role=current_interview_context.get("role", ""),
                resume_data=current_interview_context.get("resume_data", None)
            )

        evaluation = evaluator.evaluate_response(
            current_question,
            user_response.response,
            current_interview_context
        )

        question_type = evaluator._analyze_question_type(current_question)

        interview_responses.append({
            "question": current_question,
            "answer": user_response.response,
            "evaluation": evaluation,
            "question_type": question_type
        })

        current_question_index += 1

        return {
            "evaluation": evaluation,
            "question_index": current_question_index - 1,
            "total_questions": len(interview_questions),
            "question_type": question_type,
            "interview_complete": current_question_index >= len(interview_questions)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error evaluating response: {str(e)}")

# 📊 Get results
@app.get("/api/get-results")
async def get_results():
    global evaluator

    if not interview_responses:
        return {"message": "No interview responses recorded yet"}

    total_score, num_evaluated = 0, 0
    for r in interview_responses:
        try:
            score = float(r["evaluation"])
            total_score += score
            num_evaluated += 1
        except:
            pass

    average_score = total_score / num_evaluated if num_evaluated else 0
    feedback_by_type = {}

    for r in interview_responses:
        q_type = r.get("question_type", "general")
        feedback_by_type.setdefault(q_type, {
            "count": 0, "total_score": 0, "questions": []
        })
        try:
            score = float(r["evaluation"])
            fb = feedback_by_type[q_type]
            fb["count"] += 1
            fb["total_score"] += score
            fb["questions"].append({"question": r["question"], "score": score})
        except:
            pass

    for q_type, fb in feedback_by_type.items():
        if fb["count"]:
            fb["average_score"] = fb["total_score"] / fb["count"]

    return {
        "responses": interview_responses,
        "total_questions": len(interview_questions),
        "answered_questions": len(interview_responses),
        "average_score": round(average_score, 1),
        "evaluation_stats": evaluator.get_evaluation_statistics() if evaluator else {},
        "feedback_by_type": feedback_by_type
    }

# 🔍 Helper
def extract_questions(text):
    standard = re.findall(r'Question\s+\d+:\s*(.+?)(?=\s*Question\s+\d+:|$)', text, re.DOTALL)
    if standard:
        return [q.strip() for q in standard if q.strip()]
    numbered = re.findall(r'\d+\.\s*(.+?)(?=\s*\d+\.|$)', text, re.DOTALL)
    if numbered:
        return [q.strip() for q in numbered if q.strip()]
    return [l.strip() for l in text.split('\n') if len(l.strip()) >= 20 and (l.endswith('?') or l.lower().startswith(('what', 'how', 'why', 'describe', 'tell', 'can you', 'explain', 'discuss', 'imagine', 'provide')))]

# 🚀 Render-friendly entrypoint
if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
