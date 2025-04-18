# evaluator.py
import os
import re
import time
import json
from crewai import Agent, Task, Crew, Process
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional, Tuple
import hashlib
from pathlib import Path

class InterviewEvaluator:
    def __init__(self, role: str = None, resume_data: Dict = None):
        """
        Initialize the evaluator with optional context about the candidate and role.
        
        Args:
            role: The job role being applied for
            resume_data: Extracted resume data containing skills, experience, etc.
        """
        load_dotenv()
        self.api_key = os.getenv("API_KEY")
        self.api_base = os.getenv("OPENAI_API_BASE")
        self.api_model_name = os.getenv("OPENAI_MODEL_NAME")

        os.environ["OPENAI_API_BASE"] = self.api_base
        os.environ["OPENAI_MODEL_NAME"] = self.api_model_name
        os.environ["OPENAI_API_KEY"] = self.api_key
        
        # Store role and resume data for contextual evaluation
        self.role = role
        self.resume_data = resume_data
        
        # Cache to store evaluation results and reduce API calls
        self._cache_dir = Path("./cache")
        self._cache_dir.mkdir(exist_ok=True)
        
        # Evaluation history to track overall performance
        self.evaluation_history = []

    def _get_cache_key(self, question: str, answer: str) -> str:
        """Generate a unique cache key for a question-answer pair."""
        content = f"{question.strip().lower()}|{answer.strip().lower()}"
        return hashlib.md5(content.encode()).hexdigest()

    def _get_cached_evaluation(self, question: str, answer: str) -> Optional[Dict]:
        """Try to retrieve a cached evaluation result."""
        cache_key = self._get_cache_key(question, answer)
        cache_file = self._cache_dir / f"{cache_key}.json"
        
        if cache_file.exists():
            try:
                with open(cache_file, "r") as f:
                    return json.load(f)
            except Exception:
                return None
        return None

    def _save_to_cache(self, question: str, answer: str, evaluation: Dict) -> None:
        """Save evaluation result to cache."""
        cache_key = self._get_cache_key(question, answer)
        cache_file = self._cache_dir / f"{cache_key}.json"
        
        try:
            with open(cache_file, "w") as f:
                json.dump(evaluation, f)
        except Exception as e:
            print(f"Warning: Failed to save evaluation to cache: {e}")

    def evaluate_response(self, question: str, answer: str, job_context: Optional[Dict] = None) -> str:
        """
        Evaluate a single question-answer pair using CrewAI.
        
        Args:
            question: The interview question asked
            answer: The candidate's response
            job_context: Optional additional context about the job/interview
            
        Returns:
            Evaluation result (numerical score)
        """
        # Check cache first
        cached_result = self._get_cached_evaluation(question, answer)
        if cached_result:
            return cached_result["score"]
            
        # Prepare context information
        context = self._prepare_evaluation_context(question, job_context)
        
        # Analyze question type to tailor evaluation
        question_type = self._analyze_question_type(question)
        
        # Create specialized evaluator agent based on question type
        evaluator_agent = self._create_evaluator_agent(question, answer, question_type, context)

        evaluation_task = Task(
            description=self._create_task_description(question, answer, question_type, context),
            agent=evaluator_agent,
            expected_output="A numerical rating from 0-10, with only the number as the output."
        )

        evaluation_crew = Crew(
            agents=[evaluator_agent],
            tasks=[evaluation_task],
            verbose=0,
            process=Process.sequential
        )

        # Execute evaluation
        try:
            # Add retry logic
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    start_time = time.time()
                    raw_result = evaluation_crew.kickoff()
                    elapsed_time = time.time() - start_time
                    
                    # Extract just the numerical score
                    score = self._extract_score(raw_result)
                    
                    # Store evaluation metadata
                    eval_result = {
                        "score": score,
                        "question_type": question_type,
                        "timestamp": time.time(),
                        "processing_time": elapsed_time
                    }
                    
                    # Cache the result
                    self._save_to_cache(question, answer, eval_result)
                    
                    # Add to history
                    self.evaluation_history.append({
                        "question": question,
                        "answer": answer,
                        "evaluation": score,
                        "question_type": question_type
                    })
                    
                    return score
                except Exception as e:
                    if attempt < max_retries - 1:
                        print(f"Evaluation attempt {attempt+1} failed: {e}. Retrying...")
                        time.sleep(2)  # Short delay before retry
                    else:
                        raise e
        except Exception as e:
            print(f"Error during evaluation: {e}")
            return "5"  # Default middle score in case of error

    def _analyze_question_type(self, question: str) -> str:
        """
        Analyze the type of question to apply appropriate evaluation criteria.
        
        Returns one of: technical, behavioral, situational, background, motivation
        """
        question_lower = question.lower()
        
        if any(kw in question_lower for kw in ["how would you", "what would you do", "imagine"]):
            return "situational"
        elif any(kw in question_lower for kw in ["tell me about a time", "describe a situation", "give an example", "can you provide"]):
            return "behavioral"
        elif any(kw in question_lower for kw in ["experience with", "familiar with", "tell me about your experience", "worked on", "built", "developed"]):
            return "background"
        elif any(kw in question_lower for kw in ["why", "interested in", "passion", "career goals"]):
            return "motivation"
        elif any(kw in question_lower for kw in ["how do you", "explain", "describe the process", "methodology", "approach", "implement", "coding", "programming", "database", "algorithm"]):
            return "technical"
        else:
            return "general"

    def _prepare_evaluation_context(self, question: str, job_context: Optional[Dict] = None) -> Dict:
        """Prepare context information for better evaluation."""
        context = {
            "role": self.role or (job_context.get("role") if job_context else None),
            "skills": [],
            "experience_level": "entry"  # Default
        }
        
        # Include resume data if available
        if self.resume_data:
            if "skills" in self.resume_data and self.resume_data["skills"]:
                # Extract key skills relevant to the question
                all_skills = self.resume_data["skills"].lower().split("\n")
                question_lower = question.lower()
                
                # Find skills mentioned in the question
                relevant_skills = [
                    skill for skill in all_skills 
                    if any(term in question_lower for term in skill.split())
                ]
                
                context["skills"] = relevant_skills
            
            # Determine experience level
            if "years_of_experience" in self.resume_data:
                years = self.resume_data["years_of_experience"]
                if years < 2:
                    context["experience_level"] = "entry"
                elif years < 5:
                    context["experience_level"] = "mid"
                else:
                    context["experience_level"] = "senior"
        
        return context

    def _create_evaluator_agent(self, question: str, answer: str, question_type: str, context: Dict) -> Agent:
        """Create specialized evaluator agent based on question type."""
        backstory_base = (
            "You are an expert interview evaluator with years of experience in technical hiring. "
            f"You're evaluating a candidate for a {context['role'] or 'technical'} position. "
        )
        
        backstory_additions = {
            "technical": (
                "You have deep technical expertise and can judge the accuracy and depth of technical answers. "
                "You value correct technical explanations, best practices, and evidence of hands-on experience. "
                "Look for conceptual understanding rather than just terminology."
            ),
            "behavioral": (
                "You excel at assessing past behavior as an indicator of future performance. "
                "You value the STAR method (Situation, Task, Action, Result) in responses. "
                "Look for specific examples rather than hypothetical approaches."
            ),
            "situational": (
                "You can evaluate how candidates approach hypothetical scenarios. "
                "You value thought process, problem-solving methodology, and communication clarity. "
                "Look for structured approaches to tackling the scenario."
            ),
            "background": (
                "You can assess if a candidate's background aligns with job requirements. "
                "You value relevant experience, transferable skills, and learning progression. "
                "Look for evidence of claimed experience rather than just stating technologies."
            ),
            "motivation": (
                "You can detect genuine interest versus rehearsed answers about motivation. "
                "You value alignment between candidate goals and company/role opportunities. "
                "Look for specificity about this role rather than generic statements."
            ),
            "general": (
                "You have a balanced approach to evaluating interview responses. "
                "You value clarity, relevance, and depth in answers. "
                "Look for both technical accuracy and communication effectiveness."
            )
        }
        
        rating_criteria = (
            f"For this {question_type} question, rate the response on a scale of 0-10 where:\n"
            "0-2: Completely inadequate response (irrelevant, incorrect, or missing key elements)\n"
            "3-4: Below expectations (partial answer, lacks depth or specificity)\n"
            "5-6: Meets basic expectations (relevant but lacks some depth or examples)\n"
            "7-8: Strong response (specific, detailed, demonstrates experience)\n"
            "9-10: Exceptional response (comprehensive, insightful, demonstrates expertise)\n"
        )
        
        backstory = backstory_base + backstory_additions[question_type] + rating_criteria
        
        return Agent(
            role=f"{question_type.title()} Interview Evaluator",
            goal="Provide an accurate, fair assessment of the candidate's response",
            backstory=backstory,
            verbose=False,
            allow_delegation=False
        )

    def _create_task_description(self, question: str, answer: str, question_type: str, context: Dict) -> str:
        """Create a detailed task description for evaluation."""
        task_base = (
            f"Evaluate this {context['experience_level']} level candidate response to a {question_type} question.\n\n"
            f"Question: {question}\n\n"
            f"Candidate response: \"{answer}\"\n\n"
        )
        
        # Add role-specific context if available
        if context["role"]:
            task_base += f"The candidate is interviewing for a {context['role']} position.\n\n"
        
        # Add relevant skills to look for if available
        if context["skills"]:
            task_base += f"Relevant skills to assess: {', '.join(context['skills'])}\n\n"
        
        task_base += (
            "Consider the following in your evaluation:\n"
            "1. Relevance: Does the answer address the question directly?\n"
            "2. Completeness: Does it cover all aspects of the question?\n"
            "3. Specificity: Does it provide concrete examples or details?\n"
            "4. Accuracy: Is the technical information correct (if applicable)?\n"
            "5. Communication: Is the answer well-structured and clear?\n\n"
            "Provide ONLY a numerical rating from 0-10. No explanation, just the number."
        )
        
        return task_base

    def _extract_score(self, raw_result: str) -> str:
        """Extract just the numerical score from the evaluation result."""
        # First try to extract just a number
        number_match = re.search(r'\b([0-9]|10)\b', raw_result)
        if number_match:
            return number_match.group(1)
        
        # If that fails, try to interpret the response
        result_lower = raw_result.lower()
        
        if any(term in result_lower for term in ["excellent", "exceptional", "outstanding", "perfect"]):
            return "9"
        elif any(term in result_lower for term in ["good", "strong", "solid"]):
            return "7"
        elif any(term in result_lower for term in ["adequate", "acceptable", "fair", "average"]):
            return "5"
        elif any(term in result_lower for term in ["poor", "weak", "inadequate"]):
            return "3"
        elif any(term in result_lower for term in ["very poor", "terrible", "completely inadequate"]):
            return "1"
        
        # Default to middle score if we can't determine
        return "5"

    def evaluate_all_responses(self, responses: List[Dict], job_context: Optional[Dict] = None) -> List[Dict]:
        """
        Evaluate all responses from the interview.
        
        Args:
            responses: List of dictionaries with 'question' and 'answer' keys
            job_context: Optional job context information
            
        Returns:
            List of dictionaries with evaluations added
        """
        evaluations = []
        for response in responses:
            evaluation = {
                "question": response["question"],
                "answer": response["answer"],
                "evaluation": self.evaluate_response(
                    response["question"], 
                    response["answer"],
                    job_context
                ),
                "question_type": self._analyze_question_type(response["question"])
            }
            evaluations.append(evaluation)
        return evaluations

    def get_evaluation_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about the evaluations performed.
        
        Returns:
            Dictionary with evaluation statistics
        """
        if not self.evaluation_history:
            return {"count": 0, "average_score": 0}
        
        scores = [float(e["evaluation"]) for e in self.evaluation_history]
        avg_score = sum(scores) / len(scores)
        
        # Group by question type
        question_type_scores = {}
        for eval_item in self.evaluation_history:
            q_type = eval_item["question_type"]
            score = float(eval_item["evaluation"])
            
            if q_type not in question_type_scores:
                question_type_scores[q_type] = []
            
            question_type_scores[q_type].append(score)
        
        # Calculate averages by question type
        type_averages = {}
        for q_type, scores in question_type_scores.items():
            type_averages[q_type] = sum(scores) / len(scores)
        
        return {
            "count": len(scores),
            "average_score": avg_score,
            "min_score": min(scores),
            "max_score": max(scores),
            "by_question_type": type_averages
        }

# Example usage
if __name__ == "__main__":
    # Example with role and resume context
    sample_resume_data = {
        "skills": "Python, React, JavaScript, SQL, Git",
        "years_of_experience": 3
    }
    
    evaluator = InterviewEvaluator(
        role="Software Developer", 
        resume_data=sample_resume_data
    )
    
    question = "Can you describe a project where you used React to solve a complex UI problem?"
    answer = "I built a dashboard that visualized real-time data from multiple sources using React. I implemented custom hooks for data fetching and used Redux for state management. The most challenging part was optimizing performance when rendering large datasets, which I solved by implementing virtualization."
    
    score = evaluator.evaluate_response(question, answer)
    print(f"Evaluation score: {score}/10")