// ✅ ResultsDisplay.js with session ID support
import React, { useEffect, useState } from 'react';
import { useInterview } from '../context/InterviewContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const ResultsDisplay = ({ onRestart }) => {
  const { interviewState, setResults, setError } = useInterview();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const sessionId = localStorage.getItem('interview_session_id');

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/get-results?session_id=${sessionId}`);
      const result = await response.json();
      setResults(result);
    } catch (error) {
      console.error('Fetch results error:', error);
      setError('Failed to load interview results.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="results-display container mx-auto p-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Analyzing Interview Results...</h2>
        <div className="spinner"></div>
      </div>
    );
  }

  const { responses = [], total_questions, answered_questions, average_score } = interviewState.results || {};

  return (
    <div className="results-display container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Interview Results</h2>

      <p className="mb-4">You answered {answered_questions} out of {total_questions} questions.</p>
      <p className="mb-6 font-semibold text-lg">Average Score: {average_score}/10</p>

      <h3 className="text-xl font-bold mb-2">Your Answers</h3>
      {responses.map((r, index) => (
        <div key={index} className="mb-4 p-4 bg-white shadow rounded-lg">
          <p className="font-semibold mb-1">Q{index + 1}: {r.question}</p>
          <p><strong>Your Answer:</strong> {r.answer}</p>
          <p><strong>Score:</strong> {r.evaluation}/10</p>
        </div>
      ))}

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
