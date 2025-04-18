# interview.py
import os
from crewai import Agent, Task, Crew, Process
from dotenv import load_dotenv
import random
import re

def interview_candidate(resume, role, skills, experience, education):
    """
    Generate tailored interview questions based on resume data and job role.
    
    Args:
        resume (str): The full resume text
        role (str): The job role being applied for
        skills (str): Extracted skills from the resume
        experience (str): Extracted work experience from the resume
        education (str): Extracted education information from the resume
        
    Returns:
        str: Formatted interview questions
    """
    load_dotenv()
    api_key = os.getenv("API_KEY")
    api_base = os.getenv("OPENAI_API_BASE")
    api_model_name = os.getenv("OPENAI_MODEL_NAME")

    os.environ["OPENAI_API_BASE"] = api_base
    os.environ["OPENAI_MODEL_NAME"] = api_model_name
    os.environ["OPENAI_API_KEY"] = api_key

    # Enhanced job role analysis to provide more context
    jobRoleAnalysisAgent = Agent(
        role="Job Role Analyst",
        goal="Analyze the target job role to identify key requirements and competencies needed for success",
        backstory=(
            "You are an expert job analyst with extensive knowledge of different industries and roles. "
            "Your task is to analyze a job role and identify the key skills, experiences, and competencies "
            "that would be important for success in this position. You understand how different roles vary "
            "across industries and can identify both the technical and soft skills required."
        ),
        verbose=False,
        allow_delegation=False
    )

    # Enhanced resume analysis agent
    resumeAnalysisAgent = Agent(
        role="Resume Deep Analyzer",
        goal="Analyze the candidate's structured resume data to identify strengths, gaps, and areas for in-depth questioning",
        backstory=(
            "You are an expert resume analyzer with years of experience in talent acquisition. "
            "You specialize in identifying the alignment between a candidate's background and job requirements, "
            "detecting potential gaps or inconsistencies, and finding areas that require further probing during interviews. "
            "Your analysis helps create targeted, personalized interview questions that reveal a candidate's true qualifications."
        ),
        verbose=False,
        allow_delegation=False
    )

    # Question generation agent with improved context and capabilities
    questionGeneratorAgent = Agent(
        role="AI Interview Question Generator",
        goal="Generate comprehensive, tailored interview questions that assess both technical qualifications and soft skills",
        backstory=(
            "You are an AI-powered interview question generator designed to create highly effective interview questions. "
            "You understand that good interview questions should be behavioral and situational, requiring candidates to provide specific examples. "
            f"Your questions focus primarily on assessing how the candidate's **work experience** ({experience}) aligns with the requirements of the {role} position. "
            f"You also evaluate their **education** ({education}) relevance, and how they've applied their **skills** ({skills}) in real-world scenarios. "
            "You create questions that assess technical competence, problem-solving abilities, teamwork, communication, and cultural fit. "
            "Your questions are thought-provoking and designed to reveal the candidate's true capabilities beyond what's written on their resume."
        ),
        verbose=False,
        allow_delegation=False
    )

    # Task for job role analysis
    jobAnalysisTask = Task(
        description=(
            f"Analyze the job role '{role}' to identify: \n"
            "1. Key technical skills required\n"
            "2. Necessary soft skills\n"
            "3. Common challenges faced in this role\n"
            "4. Experience level expectations\n"
            "5. Industry-specific knowledge requirements\n"
            "This analysis will be used to generate relevant interview questions."
        ),
        agent=jobRoleAnalysisAgent,
        expected_output="A structured analysis of the job role requirements in bullet points"
    )

    # Task for resume gap analysis
    resumeAnalysisTask = Task(
        description=(
            f"Analyze the candidate's profile for the {role} position:\n"
            f"- Skills: {skills}\n"
            f"- Experience: {experience}\n"
            f"- Education: {education}\n\n"
            "Identify:\n"
            "1. Strengths that align well with the role\n"
            "2. Potential gaps or missing qualifications\n"
            "3. Areas where the candidate's claims need verification\n"
            "4. Experiences that require deeper explanation\n"
            "5. Unique aspects of the candidate's background worth exploring"
        ),
        agent=resumeAnalysisAgent,
        expected_output="A structured analysis of the candidate's profile with strengths and areas to probe"
    )

    # Task for generating questions
    questionGenerationTask = Task(
        description=(
            "Based on the job role analysis and resume analysis, generate 10-12 high-quality interview questions that will thoroughly assess this candidate.\n"
            "Create a mix of the following question types:\n"
            "- 3-4 technical/skills assessment questions based on the role requirements\n"
            "- 2-3 behavioral questions about past experiences\n"
            "- 1-2 situational/hypothetical scenario questions\n"
            "- 1-2 questions about gaps or inconsistencies in the resume\n"
            "- 1 question about the candidate's interest in the role and company\n"
            "- 1 question about career goals and growth\n\n"
            "Format each question as 'Question X: [Your question here]' on a new line."
        ),
        agent=questionGeneratorAgent,
        expected_output=("A numbered list of interview questions in the format: 'Question 1: [question text]', 'Question 2: [question text]', etc.")
    )

    # Create crew for sequential processing
    interviewCrew = Crew(
        agents=[jobRoleAnalysisAgent, resumeAnalysisAgent, questionGeneratorAgent],
        tasks=[jobAnalysisTask, resumeAnalysisTask, questionGenerationTask],
        verbose=0,
        process=Process.sequential
    )

    # Get interview questions
    questions = interviewCrew.kickoff()
    
    # Clean up and format the output
    questions = clean_questions(questions)
    
    return questions

def clean_questions(questions_text):
    """
    Clean up and format the questions output to ensure consistent formatting.
    
    Args:
        questions_text (str): Raw questions text
        
    Returns:
        str: Cleaned and formatted questions
    """
    # Extract questions using regex
    question_pattern = re.compile(r'Question\s+\d+:\s*(.*?)(?=Question\s+\d+:|$)', re.DOTALL)
    questions = question_pattern.findall(questions_text)
    
    # Clean up each question and remove duplicates
    clean_questions = []
    seen_questions = set()
    
    for q in questions:
        q = q.strip()
        # Skip too short questions
        if len(q) < 10:
            continue
            
        # Skip duplicate questions (check for similarity)
        q_lower = q.lower()
        is_duplicate = False
        for seen_q in seen_questions:
            if similar_questions(q_lower, seen_q):
                is_duplicate = True
                break
                
        if not is_duplicate:
            clean_questions.append(q)
            seen_questions.add(q_lower)
    
    # Format the final output
    formatted_questions = ""
    for i, q in enumerate(clean_questions, 1):
        formatted_questions += f"Question {i}: {q}\n\n"
    
    return formatted_questions

def similar_questions(q1, q2):
    """Check if questions are similar to avoid duplicates."""
    # Simple similarity check using Jaccard similarity of words
    words1 = set(q1.split())
    words2 = set(q2.split())
    
    if not words1 or not words2:
        return False
        
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    
    # If more than 70% of words are the same, consider them similar
    return len(intersection) / len(union) > 0.7

# Example usage
if __name__ == "__main__":
    resume = "John Doe's resume details..."
    role = "Software Developer"
    skills = "Python, JavaScript, React, SQL, Git"
    experience = "5 years of web development experience, led team of 3 developers, built e-commerce platform"
    education = "Bachelor of Computer Science, University of Wisconsin-Madison"

    interview_questions = interview_candidate(resume, role, skills, experience, education)
    print(interview_questions)