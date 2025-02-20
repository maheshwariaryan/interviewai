# evaluator.py
import os
from crewai import Agent, Task, Crew, Process
from dotenv import load_dotenv
from typing import List, Dict

class InterviewEvaluator:
    def __init__(self):
        load_dotenv()
        self.api_key = os.getenv("API_KEY")
        self.api_base = os.getenv("OPENAI_API_BASE")
        self.api_model_name = os.getenv("OPENAI_MODEL_NAME")

        os.environ["OPENAI_API_BASE"] = self.api_base
        os.environ["OPENAI_MODEL_NAME"] = self.api_model_name
        os.environ["OPENAI_API_KEY"] = self.api_key

    def evaluate_response(self, question: str, answer: str) -> str:
        """Evaluate a single question-answer pair using CrewAI."""
        evaluator_agent = Agent(
            role="Interview Evaluator",
            goal="Evaluate the question and the candidate's answer and give a rating for the answer to the question",
            backstory=(
                "You are an AI interviewer that will evaluate the answers given by a candidate for a question. "
                f"The question was {question} and the candidate answered with \"{answer}\". "
                "Rate this response from the candidate for the question. "
                "You are critical for the hiring process, so assess the answer and give a rating based on the job interview. "
                "Note, these are voice inputs, a few words may be misinputs so do not heavily focus on grammer. "
                "That being said, still, be smart and critical of the answers. "
                "If the cadidate replies with an unrelated answer, do not give them any points. "
                "Reward them for replying well, punish them if their answer is bad "
                "If the candidate says nothing, or provides no answer, or a very short answer, basically any "
                "answer that an interviewer would not appreciate, give a 0 or a very low score. "
                "Similarly, if the candidate gives a good, strong response, give them a high ranking. "
                "After doing all of this, give a concise feedback for the hiring team and a rating."
            ),
            verbose=False,
            allow_delegation=False
        )

        evaluation_task = Task(
            description=(
                f"Analyze the candidate's response: {answer} to this question: {question}"
            ),
            agent=evaluator_agent,
            expected_output="The output should be a concise feedback for the hiring team and a rating."
        )

        evaluation_crew = Crew(
            agents=[evaluator_agent],
            tasks=[evaluation_task],
            verbose=0,
            process=Process.sequential
        )

        return evaluation_crew.kickoff()

    def evaluate_all_responses(self, responses: List[Dict]) -> List[Dict]:
        """Evaluate all responses from the interview."""
        evaluations = []
        for response in responses:
            evaluation = {
                "question": response["question"],
                "answer": response["answer"],
                "evaluation": self.evaluate_response(response["question"], response["answer"])
            }
            evaluations.append(evaluation)
        return evaluations