# main.py
import json
import re
from evaluator import InterviewEvaluator

def extract_questions(input_text):
    """Extracts questions from the input text dynamically."""
    questions = re.findall(r'Question \d+: (.+?)\n', input_text)
    return questions

def interview_candidate(questions):
    """Asks questions one by one and stores responses."""
    responses = []
    for question in questions:
        response = input(f"{question}\nYour answer: ")
        responses.append({"question": question, "answer": response})
    return responses

if __name__ == "__main__":
    input_text = """
    Question 1: Can you walk me through a specific project you worked on during your 5-year tenure as a Software Developer at XYZ Corp? How did your role contribute to the project's overall success?

    Question 2: As a Software Developer, what were some of the most significant challenges you faced, and how did you overcome them? Were there any instances where you had to troubleshoot or debug complex issues?

    Question 3: Can you describe a situation where you had to collaborate with other teams, such as QA or Product Management, to deliver a software feature? What was your role in that collaboration, and what was the outcome?
    """  # Shortened for example
    
    # Get questions and conduct interview
    interview_questions = extract_questions(input_text)
    responses = interview_candidate(interview_questions)
    
    # Initialize evaluator and evaluate responses
    evaluator = InterviewEvaluator()
    evaluations = evaluator.evaluate_all_responses(responses)
    
    # Save results to file
    output = {
        "interview_results": evaluations
    }
    
    # Print results
    print("\nInterview Results:")
    for eval in evaluations:
        print(f"\nQuestion: {eval['question']}")
        print(f"Answer: {eval['answer']}")
        print(f"Evaluation: {eval['evaluation']}")
    
    print("\nResults have been saved to 'interview_results.json'")