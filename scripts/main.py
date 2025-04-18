# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
from evaluator import InterviewEvaluator
from questions_generator import interview_candidate
from resume_parser import extract_details as extract_resume_details
from typing import List, Dict, Optional

app = FastAPI()

# Configure CORS to allow requests from your React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://interviewai-bay.vercel.app/"],  # Your React app's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state to store questions and current question index
interview_questions = []
current_question_index = 0
interview_responses = []

# Global state to store interview context
current_interview_context = {
    "role": "",
    "resume_data": None
}

# Global evaluator instance
evaluator = None

class ResponseModel(BaseModel):
    response: str

# Define ResumeContent class here to match the one in resume_parser.py
class ResumeContent(BaseModel):
    content: str

class InterviewConfigModel(BaseModel):
    role: str
    skills: Optional[str] = None
    experience: Optional[str] = None
    education: Optional[str] = None

@app.post("/api/extract-resume")
async def extract_resume(resume_data: ResumeContent):
    """Extract details from a resume."""
    try:
        # Pass the ResumeContent object directly, no need to recreate it
        details = await extract_resume_details(resume_data)
        return details
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting resume details: {str(e)}")

@app.post("/api/generate-questions")
async def generate_questions(config: InterviewConfigModel):
    """Generate interview questions based on resume components and role."""
    global interview_questions, current_question_index
    
    try:
        # If we have the extracted components, we can reconstruct a simplified resume
        if config.skills or config.experience or config.education:
            simplified_resume = f"""
Skills:
{config.skills or ""}

Experience:
{config.experience or ""}

Education:
{config.education or ""}
            """
        else:
            simplified_resume = config.resume or ""
        
        # Generate questions using the interview module
        questions_text = interview_candidate(
            resume=simplified_resume,
            role=config.role,
            skills=config.skills or "",
            experience=config.experience or "",
            education=config.education or ""
        )
        
        # Extract questions from the generated text
        interview_questions = extract_questions(questions_text)
        current_question_index = 0
        interview_responses.clear()
        
        return {"total_questions": len(interview_questions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating questions: {str(e)}")

@app.get("/api/get-question")
async def get_question():
    global current_question_index, interview_questions

    if not interview_questions or current_question_index >= len(interview_questions):
        return {"question": "No questions available. Please generate questions first.", "remaining": 0}
    
    question = interview_questions[current_question_index]
    remaining = len(interview_questions) - current_question_index - 1
    
    # Add question type
    question_type = "unknown"
    if evaluator:
        question_type = evaluator._analyze_question_type(question)
    
    return {
        "question": question, 
        "remaining": remaining,
        "question_type": question_type,
        "question_index": current_question_index
    }


@app.post("/api/submit-response")
async def submit_response(user_response: ResponseModel):
    """Submit and evaluate a response to the current question."""
    global current_question_index, interview_questions, interview_responses, evaluator
    
    if not interview_questions or current_question_index >= len(interview_questions):
        raise HTTPException(status_code=400, detail="No active question to respond to")
    
    try:
        # Get the current question
        current_question = interview_questions[current_question_index]
        
        # Make sure evaluator is initialized
        if not evaluator:
            evaluator = InterviewEvaluator(
                role=current_interview_context.get("role", ""),
                resume_data=current_interview_context.get("resume_data", None)
            )
        
        # Evaluate the response
        evaluation = evaluator.evaluate_response(
            current_question, 
            user_response.response,
            current_interview_context
        )
        
        # Get the question type
        question_type = evaluator._analyze_question_type(current_question)
        
        # Store the response and evaluation
        interview_responses.append({
            "question": current_question,
            "answer": user_response.response,
            "evaluation": evaluation,
            "question_type": question_type
        })
        
        # Move to the next question
        current_question_index += 1
        
        # Return the evaluation result
        return {
            "evaluation": evaluation, 
            "question_index": current_question_index - 1,
            "total_questions": len(interview_questions),
            "question_type": question_type,
            "interview_complete": current_question_index >= len(interview_questions)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error evaluating response: {str(e)}")

@app.get("/api/get-results")
async def get_results():
    """Get the complete interview results."""
    global evaluator
    
    if not interview_responses:
        return {"message": "No interview responses recorded yet"}
    
    total_score = 0
    num_evaluated = 0
    
    for response in interview_responses:
        try:
            # Try to convert evaluation to a number
            score = float(response["evaluation"])
            total_score += score
            num_evaluated += 1
        except (ValueError, TypeError):
            # Skip if not a valid number
            pass
    
    average_score = total_score / num_evaluated if num_evaluated > 0 else 0
    
    # Get evaluation statistics if available
    evaluation_stats = {}
    if evaluator:
        evaluation_stats = evaluator.get_evaluation_statistics()
    
    # Prepare feedback by question type
    feedback_by_type = {}
    for response in interview_responses:
        q_type = response.get("question_type", "general")
        if q_type not in feedback_by_type:
            feedback_by_type[q_type] = {
                "count": 0,
                "total_score": 0,
                "questions": []
            }
        
        try:
            score = float(response["evaluation"])
            feedback_by_type[q_type]["count"] += 1
            feedback_by_type[q_type]["total_score"] += score
            feedback_by_type[q_type]["questions"].append({
                "question": response["question"],
                "score": score
            })
        except (ValueError, TypeError):
            pass
    
    # Calculate averages for each question type
    for q_type in feedback_by_type:
        if feedback_by_type[q_type]["count"] > 0:
            feedback_by_type[q_type]["average_score"] = (
                feedback_by_type[q_type]["total_score"] / 
                feedback_by_type[q_type]["count"]
            )
    
    return {
        "responses": interview_responses,
        "total_questions": len(interview_questions),
        "answered_questions": len(interview_responses),
        "average_score": round(average_score, 1),
        "evaluation_stats": evaluation_stats,
        "feedback_by_type": feedback_by_type
    }

def extract_questions(text):
    """Extracts questions from formatted text."""
    # First try to match the standard "Question X: content" format
    standard_questions = re.findall(r'Question\s+\d+:\s*(.+?)(?=\s*Question\s+\d+:|$)', text, re.DOTALL)
    
    # If we found questions in the standard format, clean and return them
    if standard_questions:
        # Clean up any trailing whitespace and skip empty questions
        clean_questions = [q.strip() for q in standard_questions if q.strip()]
        return clean_questions
    
    # As a fallback, try to handle the numbered list format like "1. Question content"
    numbered_questions = re.findall(r'\d+\.\s*(.+?)(?=\s*\d+\.|$)', text, re.DOTALL)
    
    if numbered_questions:
        # Clean up any trailing whitespace and skip empty questions
        clean_questions = [q.strip() for q in numbered_questions if q.strip()]
        return clean_questions
    
    # If all else fails, just split by newlines and try to find sensible questions
    lines = text.split('\n')
    candidate_questions = []
    
    for line in lines:
        line = line.strip()
        # Only consider lines that are at least 20 characters and end with a question mark
        # or are likely to be questions based on starting words
        if len(line) >= 20 and (
            line.endswith('?') or 
            any(line.lower().startswith(q) for q in [
                'what', 'how', 'why', 'describe', 'tell me', 'can you', 'explain', 
                'discuss', 'imagine', 'provide'
            ])
        ):
            candidate_questions.append(line)
    
    return candidate_questions if candidate_questions else []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)