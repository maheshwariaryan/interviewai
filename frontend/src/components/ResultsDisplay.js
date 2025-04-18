// src/components/ResultsDisplay.js
import React, { useEffect, useState } from 'react';
import { useInterview } from '../context/InterviewContext';
import { getInterviewResults } from '../services/api';

const ResultsDisplay = ({ onRestart }) => {
  const { interviewState, setResults, setError } = useInterview();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch results when component mounts
  useEffect(() => {
    fetchResults();
  }, []);

  // Fetch interview results
  const fetchResults = async () => {
    try {
      setIsLoading(true);
      
      // Get results from API
      const results = await getInterviewResults();
      
      // Update results in context
      setResults(results);
    } catch (error) {
      console.error('Fetch results error:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Get score color class based on score
  const getScoreColorClass = (score) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get advice based on overall score
  const getOverallAdvice = (score) => {
    if (score >= 8) {
      return "Excellent performance! You demonstrated strong qualifications for this role. Consider highlighting these strengths in your follow-up communications.";
    } else if (score >= 6) {
      return "Good performance overall. You've demonstrated relevant skills, but there are some areas for improvement.";
    } else if (score >= 4) {
      return "You showed some relevant qualifications, but there are significant areas for improvement. Consider practicing with more mock interviews.";
    } else {
      return "Your responses need significant improvement to be competitive for this role. Consider additional preparation and practice before interviewing.";
    }
  };

  // Get advice for specific question types
  const getQuestionTypeAdvice = (questionType, score) => {
    const adviceMap = {
      'technical': {
        high: "Your technical knowledge is strong. Continue to deepen your expertise and stay current with industry trends.",
        medium: "You've demonstrated solid technical fundamentals. Consider expanding your knowledge in more advanced topics.",
        low: "Focus on strengthening your technical knowledge through additional study and hands-on practice."
      },
      'behavioral': {
        high: "You effectively communicate your past experiences with clear examples. Continue using the STAR method.",
        medium: "Your behavioral examples are good but could be more structured. Practice using the STAR method (Situation, Task, Action, Result).",
        low: "Work on preparing specific examples from your experience for common behavioral questions."
      },
      'situational': {
        high: "You handle hypothetical scenarios well with structured thinking and clear communication.",
        medium: "Your approach to scenarios is reasonable but could benefit from more structured problem-solving.",
        low: "Practice breaking down complex problems step-by-step and communicating your thought process."
      },
      'background': {
        high: "You effectively highlight relevant aspects of your background for the role.",
        medium: "You mention relevant experience but could better connect it to the job requirements.",
        low: "Focus on clearly explaining how your background prepares you for the specific requirements of this role."
      },
      'motivation': {
        high: "Your enthusiasm and specific interest in this role come across clearly.",
        medium: "You show interest in the role but could be more specific about why it appeals to you.",
        low: "Research the company and role more deeply to demonstrate genuine, specific interest."
      }
    };

    const level = score >= 8 ? 'high' : (score >= 5 ? 'medium' : 'low');
    return adviceMap[questionType]?.[level] || adviceMap['behavioral'][level];
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="results-display container mx-auto p-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Analyzing Interview Results...</h2>
        <div className="spinner"></div>
      </div>
    );
  }

  // Render no results state
  if (!interviewState.results || !interviewState.results.responses) {
    return (
      <div className="results-display container mx-auto p-4">
        <h2 className="text-2xl font-bold mb-4">Interview Results</h2>
        <p>No interview results available.</p>
        
        <button
          className="px-4 py-2 mt-4 bg-blue-600 text-white rounded"
          onClick={onRestart}
        >
          Start New Interview
        </button>
      </div>
    );
  }

  const { 
    responses, 
    total_questions, 
    answered_questions, 
    average_score,
    feedback_by_type = {},
  } = interviewState.results;

  // Prepare data for radar chart
  const questionTypes = Object.keys(feedback_by_type);
  const typeScores = questionTypes.map(type => 
    feedback_by_type[type].average_score || 0
  );

  // Calculate strengths and weaknesses
  const strengths = [];
  const weaknesses = [];

  questionTypes.forEach(type => {
    const data = feedback_by_type[type];
    const score = data.average_score || 0;
    
    if (score >= 7) {
      strengths.push({
        type,
        score,
        advice: getQuestionTypeAdvice(type, score)
      });
    } else if (score <= 5) {
      weaknesses.push({
        type,
        score,
        advice: getQuestionTypeAdvice(type, score)
      });
    }
  });

  // Sort by score (descending for strengths, ascending for weaknesses)
  strengths.sort((a, b) => b.score - a.score);
  weaknesses.sort((a, b) => a.score - b.score);

  return (
    <div className="results-display container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Interview Results</h2>
      
      {/* Tab Navigation */}
      <div className="flex border-b mb-6">
        <button 
          className={`px-4 py-2 ${activeTab === 'overview' ? 'border-b-2 border-blue-500 text-blue-600 font-bold' : 'text-gray-600'}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`px-4 py-2 ${activeTab === 'responses' ? 'border-b-2 border-blue-500 text-blue-600 font-bold' : 'text-gray-600'}`}
          onClick={() => setActiveTab('responses')}
        >
          Detailed Responses
        </button>
        <button 
          className={`px-4 py-2 ${activeTab === 'feedback' ? 'border-b-2 border-blue-500 text-blue-600 font-bold' : 'text-gray-600'}`}
          onClick={() => setActiveTab('feedback')}
        >
          Feedback & Advice
        </button>
      </div>
      
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <div className="mb-6 p-6 bg-white rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
              <h3 className="text-xl font-bold mb-2 sm:mb-0">Overall Performance</h3>
              <div className="flex items-center">
                <span className="mr-2">Score:</span>
                <span className={`text-3xl font-bold ${getScoreColorClass(average_score)}`}>
                  {average_score.toFixed(1)}/10
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-600">Questions</p>
                <p className="text-xl font-bold">{answered_questions} of {total_questions}</p>
              </div>
              
              {questionTypes.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Strongest Area</p>
                  <p className="text-xl font-bold capitalize">
                    {strengths[0]?.type || 'None'}
                    {strengths[0] && (
                      <span className={`text-sm ml-2 ${getScoreColorClass(strengths[0].score)}`}>
                        ({strengths[0].score.toFixed(1)})
                      </span>
                    )}
                  </p>
                </div>
              )}
              
              {questionTypes.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Area to Improve</p>
                  <p className="text-xl font-bold capitalize">
                    {weaknesses[0]?.type || 'None'}
                    {weaknesses[0] && (
                      <span className={`text-sm ml-2 ${getScoreColorClass(weaknesses[0].score)}`}>
                        ({weaknesses[0].score.toFixed(1)})
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
            
            {questionTypes.length > 0 && (
              <div className="mb-4">
                <h4 className="font-bold mb-2">Performance by Question Type</h4>
                <div className="w-full bg-gray-200 rounded-lg p-4">
                  {questionTypes.map((type, index) => {
                    const score = feedback_by_type[type].average_score || 0;
                    return (
                      <div key={type} className="mb-2 last:mb-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm capitalize">{type}</span>
                          <span className={`text-sm ${getScoreColorClass(score)}`}>
                            {score.toFixed(1)}/10
                          </span>
                        </div>
                        <div className="w-full bg-gray-300 rounded-full h-2.5">
                          <div 
                            className={`h-2.5 rounded-full ${score >= 8 ? 'bg-green-600' : score >= 6 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${(score/10) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-bold text-blue-800 mb-2">Overall Assessment</h4>
              <p>{getOverallAdvice(average_score)}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Detailed Responses Tab */}
      {activeTab === 'responses' && (
        <div>
          <h3 className="text-xl font-bold mb-4">Your Interview Responses</h3>
          
          {responses && responses.map((response, index) => (
            <div key={index} className="mb-6 p-4 bg-white shadow rounded-lg">
              <div className="flex justify-between">
                <h4 className="font-bold">Question {index + 1}:</h4>
                {response.question_type && (
                  <span className="px-2 py-1 bg-gray-200 rounded-full text-xs capitalize">
                    {response.question_type}
                  </span>
                )}
              </div>
              <p className="mb-4">{response.question}</p>
              
              <h4 className="font-bold mt-4">Your Answer:</h4>
              <p className="mb-4 bg-gray-50 p-3 rounded">{response.answer}</p>
              
              <div className="flex justify-between items-center mt-4">
                <h4 className="font-bold">Score:</h4>
                <p className={`font-bold ${getScoreColorClass(parseFloat(response.evaluation))}`}>
                  {response.evaluation}/10
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Feedback and Advice Tab */}
      {activeTab === 'feedback' && (
        <div>
          <div className="mb-6 p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-4">Personalized Feedback</h3>
            
            {strengths.length > 0 && (
              <div className="mb-6">
                <h4 className="font-bold text-green-700 mb-2">Your Strengths</h4>
                <ul className="list-disc pl-5">
                  {strengths.map((item, index) => (
                    <li key={index} className="mb-2">
                      <span className="font-medium capitalize">{item.type}:</span> {item.advice}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {weaknesses.length > 0 && (
              <div className="mb-6">
                <h4 className="font-bold text-red-700 mb-2">Areas for Improvement</h4>
                <ul className="list-disc pl-5">
                  {weaknesses.map((item, index) => (
                    <li key={index} className="mb-2">
                      <span className="font-medium capitalize">{item.type}:</span> {item.advice}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-bold text-yellow-800 mb-2">Interview Prep Tips</h4>
              <ul className="list-disc pl-5">
                <li className="mb-2">Review your responses for areas where you could provide more specific examples.</li>
                <li className="mb-2">Practice structuring your answers using the STAR method (Situation, Task, Action, Result).</li>
                <li className="mb-2">Research the company thoroughly before your next interview.</li>
                <li className="mb-2">Prepare 2-3 questions to ask the interviewer at the end of the interview.</li>
                <li className="mb-2">Send a follow-up thank you note within 24 hours of your interview.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      
      <button
        className="px-4 py-2 mt-4 bg-blue-600 text-white rounded"
        onClick={onRestart}
      >
        Start New Interview
      </button>
    </div>
  );
};

export default ResultsDisplay;