import os
from crewai import Agent, Task, Crew, Process
from dotenv import load_dotenv

def interview_candidate(resume, role, skills, experience, education):
    load_dotenv()
    api_key = os.getenv("API_KEY")
    api_base = os.getenv("OPENAI_API_BASE")
    api_model_name = os.getenv("OPENAI_MODEL_NAME")

    os.environ["OPENAI_API_BASE"] = api_base
    os.environ["OPENAI_MODEL_NAME"] = api_model_name
    os.environ["OPENAI_API_KEY"] = api_key

    resumeAgent = Agent(
        role="AI Resume Interviewer",
        goal="Analyze the candidate's structured resume data and generate a tailored list of interview questions, prioritizing work experience, followed by education, and lightly covering skills.",
        backstory=(
            "You are an AI-powered resume interviewer designed to thoroughly assess candidates based on structured resume data and the specific job role they are applying for. "
            "Instead of analyzing raw text, you are provided with extracted key details from the resume, including their skills, work experience, and education. "
            f"Your primary focus is to question the candidate about their **work experience** ({experience}), ensuring that their past roles, responsibilities, and achievements align with the expectations of the job {role}. "
            "Ask detailed, in-depth questions about their actual contributions, challenges faced, and problem-solving approaches in previous roles. "
            f"You should also ask questions about their **education** ({education}), especially if it is relevant to the job, but this should be secondary to experience. "
            f"For **skills** ({skills}), avoid simply listing them—instead, ask questions about how they have applied these skills in real-world scenarios. "
            "Your questions must be highly targeted, avoiding generic or irrelevant inquiries. "
            "Ensure the questions challenge the candidate, verify their claims, and assess their suitability for the role."
        ),
        verbose=False,
        allow_delegation=False
    )

    checkboxTask = Task(
        description=(
            f"Analyze the structured resume data and determine which key requirements for the role {role} are met. "
            f"Carefully compare the candidate’s **skills** ({skills}), **work experience** ({experience}), and **education** ({education}) against the job expectations. "
        ),
        agent=resumeAgent,
        expected_output=("The output should be a structured in the below format: "
            "Question 1: question here, Question 2: question here, Question 3: question here, and so on. So Question (number), question."
        )
    )

    fileCrew = Crew(
        agents=[resumeAgent],
        tasks=[checkboxTask],
        verbose=0,
        process=Process.sequential
    )

    answer = fileCrew.kickoff()
    
    return answer

# Example usage
if __name__ == "__main__":
    resume = "John Doe's resume details..."
    role = "Software Engineer"
    skills = "Python, Machine Learning, API Development"
    experience = "Worked at XYZ Corp for 5 years as a Software Developer..."
    education = "BSc in Computer Science from ABC University"

    interview_questions = interview_candidate(resume, role, skills, experience, education)
    print(interview_questions)
