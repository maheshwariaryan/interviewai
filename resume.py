import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from crewai import Agent, Task, Crew, Process
from dotenv import load_dotenv
import uvicorn
 
app = FastAPI()
 
load_dotenv()
api_key = os.getenv("API_KEY")
api_base = os.getenv("OPENAI_API_BASE")
api_model_name = os.getenv("OPENAI_MODEL_NAME")

os.environ["OPENAI_API_BASE"] = api_base
os.environ["OPENAI_MODEL_NAME"] = api_model_name
os.environ["OPENAI_API_KEY"] = api_key
 
class ResumeContent(BaseModel):
    content: str
 
@app.post("/extract_details/")
async def extract_details(resume_content: ResumeContent):
    try:
        # Define agents for different extractions
        skill_extraction_agent = Agent(
            role="skill-extraction",
            goal="Extract a list of skills from the provided resume content.",
            backstory="You are an AI agent trained to understand and extract skills from resumes.",
            verbose=False,
            allow_delegation=False
        )
 
        experience_extraction_agent = Agent(
            role="experience-extraction",
            goal="Extract the professional experience details from the provided resume content.",
            backstory="You are an AI agent trained to understand and extract professional experience from resumes.",
            verbose=False,
            allow_delegation=False
        )
 
        education_extraction_agent = Agent(
            role="education-extraction",
            goal="Extract the education qualifications from the provided resume content.",
            backstory="You are an AI agent trained to understand and extract education qualifications from resumes.",
            verbose=False,
            allow_delegation=False
        )
 
        certification_extraction_agent = Agent(
            role="certification-extraction",
            goal="Extract the certifications from the provided resume content.",
            backstory="You are an AI agent trained to understand and extract certifications from resumes.",
            verbose=False,
            allow_delegation=False
        )
 
        # Define tasks for different extractions
        skill_extraction_task = Task(
            description=f"Extract skills from the following resume content: '{resume_content.content}'",
            agent=skill_extraction_agent,
            expected_output="A list of skills extracted from the resume content."
        )
 
        experience_extraction_task = Task(
            description=f"Extract professional experience details from the following resume content: '{resume_content.content}'",
            agent=experience_extraction_agent,
            expected_output="Professional experience details extracted from the resume content."
        )
 
        education_extraction_task = Task(
            description=f"Extract education qualifications from the following resume content: '{resume_content.content}'",
            agent=education_extraction_agent,
            expected_output="Education qualifications extracted from the resume content."
        )
 
        certification_extraction_task = Task(
            description=f"Extract certifications from the following resume content: '{resume_content.content}'",
            agent=certification_extraction_agent,
            expected_output="Certifications extracted from the resume content."
        )
 
        # Define crews for each type of extraction
        skill_extraction_crew = Crew(
            agents=[skill_extraction_agent],
            tasks=[skill_extraction_task],
            verbose=0,
            process=Process.sequential
        )
 
        experience_extraction_crew = Crew(
            agents=[experience_extraction_agent],
            tasks=[experience_extraction_task],
            verbose=0,
            process=Process.sequential
        )
 
        education_extraction_crew = Crew(
            agents=[education_extraction_agent],
            tasks=[education_extraction_task],
            verbose=0,
            process=Process.sequential
        )
 
        certification_extraction_crew = Crew(
            agents=[certification_extraction_agent],
            tasks=[certification_extraction_task],
            verbose=0,
            process=Process.sequential
        )
 
        # Execute the crews and get the results
        skill_extraction_result = skill_extraction_crew.kickoff()
        experience_extraction_result = experience_extraction_crew.kickoff()
        education_extraction_result = education_extraction_crew.kickoff()
        certification_extraction_result = certification_extraction_crew.kickoff()
 
        # Convert to strings if necessary
        if isinstance(skill_extraction_result, list):
            skill_extraction_result = "\n".join(skill_extraction_result)
       
        if isinstance(experience_extraction_result, list):
            experience_extraction_result = "\n".join(experience_extraction_result)
       
        if isinstance(education_extraction_result, list):
            education_extraction_result = "\n".join(education_extraction_result)
       
        if isinstance(certification_extraction_result, list):
            certification_extraction_result = "\n".join(certification_extraction_result)
 
        # Calculate number of years of experience
        years_of_experience = 0
        if isinstance(experience_extraction_result, str):
            for experience in experience_extraction_result.split("\n"):
                if "years" in experience.lower():
                    years_str = experience.split()[0]
                    if years_str.isdigit():
                        years_of_experience += int(years_str)
 
        # Count the number of certifications
        num_certifications = 0
        if isinstance(certification_extraction_result, str):
            num_certifications = len(certification_extraction_result.split("\n"))
 
        # Combine the results into a single response
        result = {
            "skills": skill_extraction_result,
            "experience": experience_extraction_result,
            "education": education_extraction_result,
            "certifications": certification_extraction_result,
            "years_of_experience": years_of_experience,
            "num_certifications": num_certifications
        }
 
        return result
 
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")
    
if __name__ == "__main__":
    uvicorn.run("resume:app", host="127.0.0.1", port=8001, reload=True)