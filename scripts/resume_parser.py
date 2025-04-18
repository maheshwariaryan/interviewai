# resume.py
import os
import re
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

def preprocess_text(text):
    """
    Preprocess the text from PDF conversion to make it more suitable for extraction
    """
    # Convert multiple spaces to single space
    text = re.sub(r'\s+', ' ', text)
    
    # Fix common PDF conversion issues with bullet points
    text = text.replace('•', '\n• ')
    
    # Make sure there are newlines before common section headers
    section_headers = [
        'EDUCATION', 'Education', 'EXPERIENCE', 'Experience', 'SKILLS', 'Skills',
        'CERTIFICATIONS', 'Certifications', 'PROJECTS', 'Projects',
        'WORK EXPERIENCE', 'Work Experience', 'PROFESSIONAL EXPERIENCE', 'Professional Experience',
        'ACADEMIC BACKGROUND', 'Academic Background', 'TECHNICAL SKILLS', 'Technical Skills'
    ]
    
    for header in section_headers:
        text = re.sub(r'([^\n])(' + header + r')', r'\1\n\n\2', text)
    
    # Add spacing after dates (common in experience sections)
    text = re.sub(r'(\b(19|20)\d{2}\s*(-|–|to)\s*(19|20)\d{2}|Present|Current)\b', r'\1\n', text)
    
    # Normalize different dash types
    text = text.replace('–', '-').replace('—', '-')
    
    return text

def identify_resume_sections(text):
    """
    Try to identify major sections of the resume to help with extraction
    """
    sections = {}
    
    # Common section identifiers with variations
    section_patterns = {
        'education': r'(?i)(EDUCATION|ACADEMIC|DEGREE|UNIVERSITY|SCHOOL)',
        'experience': r'(?i)(EXPERIENCE|EMPLOYMENT|WORK|PROFESSIONAL|HISTORY|CAREER)',
        'skills': r'(?i)(SKILLS|TECHNOLOGIES|TECHNICAL|COMPETENCIES|PROFICIENCIES)',
        'certifications': r'(?i)(CERTIFICATIONS|CERTIFICATES|LICENSES|CREDENTIALS)',
        'projects': r'(?i)(PROJECTS|PORTFOLIO|WORKS)'
    }
    
    # Find the indices of section headers
    section_indices = []
    for section, pattern in section_patterns.items():
        matches = re.finditer(pattern, text)
        for match in matches:
            section_indices.append((match.start(), section))
    
    # Sort by position in text
    section_indices.sort()
    
    # Extract sections based on the indices
    for i in range(len(section_indices)):
        start_idx = section_indices[i][0]
        section_name = section_indices[i][1]
        
        # End index is either the start of the next section or the end of the text
        end_idx = section_indices[i+1][0] if i < len(section_indices) - 1 else len(text)
        
        # Extract this section's content
        section_content = text[start_idx:end_idx].strip()
        
        # Add to our sections dictionary, appending if section already exists
        if section_name in sections:
            sections[section_name] += "\n" + section_content
        else:
            sections[section_name] = section_content
    
    return sections

@app.post("/details/")
async def extract_details(resume_content: ResumeContent):
    try:
        # Preprocess the text from PDF
        processed_text = preprocess_text(resume_content.content)
        
        # Try to identify resume sections to provide better context
        sections = identify_resume_sections(processed_text)
        
        # Define agents with improved prompts
        skill_extraction_agent = Agent(
            role="skill-extraction",
            goal="Extract a comprehensive list of skills from the provided resume content.",
            backstory=(
                "You are an AI agent specialized in identifying and extracting technical, soft, and domain-specific skills from resumes. "
                "You understand industry jargon, technical terms, and can recognize skills even when they're embedded within project descriptions or work experience. "
                "You categorize skills into technical (programming languages, tools, platforms), soft skills (communication, leadership), "
                "and domain-specific knowledge areas."
            ),
            verbose=False,
            allow_delegation=False
        )
 
        experience_extraction_agent = Agent(
            role="experience-extraction",
            goal="Extract detailed professional experience from the provided resume content.",
            backstory=(
                "You are an AI agent trained to understand and extract professional experience from resumes. "
                "You can identify job titles, employer names, dates of employment, and key responsibilities. "
                "You understand how to parse various formats of experience listings and can extract relevant details "
                "even when the information is presented in different styles or formats. You maintain the chronological "
                "order and structure of the experience, and you can calculate total years of experience."
            ),
            verbose=False,
            allow_delegation=False
        )
 
        education_extraction_agent = Agent(
            role="education-extraction",
            goal="Extract comprehensive education qualifications from the provided resume content.",
            backstory=(
                "You are an AI agent specialized in extracting education information from resumes. "
                "You can identify degrees, majors, minors, institutions, graduation dates, GPAs, honors, and relevant coursework. "
                "You understand different education systems globally and can normalize different formats to extract consistent information. "
                "You present education in a structured and chronological order."
            ),
            verbose=False,
            allow_delegation=False
        )
 
        certification_extraction_agent = Agent(
            role="certification-extraction",
            goal="Extract complete certification information from the provided resume content.",
            backstory=(
                "You are an AI agent trained to identify and extract professional certifications from resumes. "
                "You can recognize certification names, issuing organizations, dates of obtainment, expiration dates, and credential IDs. "
                "You understand industry-specific certifications across various fields and can extract them accurately "
                "even when they're mentioned in different sections of the resume or in different formats."
            ),
            verbose=False,
            allow_delegation=False
        )
 
        # Enhance task descriptions using identified sections
        skill_task_description = f"Extract skills from the following resume content, focusing especially on technical and professional skills. If available, pay special attention to the skills section:\n\n{sections.get('skills', processed_text)}"
        
        experience_task_description = f"Extract professional experience details, including job titles, companies, dates, and responsibilities. If available, focus on the experience section:\n\n{sections.get('experience', processed_text)}"
        
        education_task_description = f"Extract education qualifications, including degrees, institutions, and dates. If available, focus on the education section:\n\n{sections.get('education', processed_text)}"
        
        certification_task_description = f"Extract certifications, including names, issuers, and dates. If available, focus on the certifications section:\n\n{sections.get('certifications', processed_text)}"
        
        # Define tasks with enhanced descriptions
        skill_extraction_task = Task(
            description=skill_task_description,
            agent=skill_extraction_agent,
            expected_output="A structured, categorized list of skills extracted from the resume content."
        )
 
        experience_extraction_task = Task(
            description=experience_task_description,
            agent=experience_extraction_agent,
            expected_output="A chronological list of professional experiences with company names, job titles, dates, and key responsibilities."
        )
 
        education_extraction_task = Task(
            description=education_task_description,
            agent=education_extraction_agent,
            expected_output="A list of education qualifications with institutions, degrees, dates, and relevant details."
        )
 
        certification_extraction_task = Task(
            description=certification_task_description,
            agent=certification_extraction_agent,
            expected_output="A list of certifications with names, issuing organizations, and dates."
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
            # Look for patterns like "X years" or date ranges
            year_patterns = re.findall(r'(\d+)\s*(?:years?|yrs?)', experience_extraction_result, re.IGNORECASE)
            for year_str in year_patterns:
                if year_str.isdigit():
                    years_of_experience += int(year_str)
            
            # If no explicit year mentions, try to calculate from date ranges
            if years_of_experience == 0:
                date_ranges = re.findall(r'(\d{4})\s*-\s*(\d{4}|Present|Current)', experience_extraction_result)
                current_year = 2025  # Assuming current year
                for start, end in date_ranges:
                    end_year = current_year if end.lower() in ['present', 'current'] else int(end)
                    years_of_experience += (end_year - int(start))
 
        # Count the number of certifications
        num_certifications = 0
        if isinstance(certification_extraction_result, str):
            # Count lines or certification mentions
            cert_lines = [line for line in certification_extraction_result.split('\n') if line.strip()]
            num_certifications = len(cert_lines)
 
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
    uvicorn.run("resume_parser:app", host="127.0.0.1", port=8001, reload=True)