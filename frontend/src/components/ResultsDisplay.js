// src/components/ResultsDisplay.js
import React, { useEffect, useState } from 'react';
import { useInterview } from '../context/InterviewContext';
import { getInterviewResults } from '../services/api';

const ResultsDisplay = ({ onRestart }) => {
  const { interviewState, setResults, setError } = useInterview();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Get the session ID from localStorage
  const sessionId = localStorage.getItem('interview_session_id');

  // Fetch results on component mount
  useEffect(() => {
    if (!sessionId) {
      setError("Session ID missing. Please restart the interview.");
      setIsLoading(false);
      return;
    }
    fetchResults();
  }, []);

  // Fetch interview results from the API
  const fetchResults = async () => {
    try {
      setIsLoading(true);
      const result = await getInterviewResults(sessionId);
      setResults(result);
    } catch (error) {
      console.error('Fetch results error:', error);
      setError('Failed to load interview results. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle restarting the interview
  const handleRestart = () => {
    // Clear session data
    localStorage.removeItem('interview_session_id');
    // Call the restart function from props
    onRestart?.();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="results-display container mx-auto p-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Analyzing Interview Results...</h2>
        <div className="spinner"></div>
      </div>
    );
  }

  // Error state
  if (!interviewState.results) {
    return (
      <div className="results-display container mx-auto p-4">
        <h2 className="text-2xl font-bold mb-4">Interview Results</h2>
        <div className="bg-red-50 p-4 rounded mb-4 text-red-700">
          <p>We couldn't load your interview results. Please try restarting the interview.</p>
        </div>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={handleRestart}
        >
          Start New Interview
        </button>
      </div>
    );
  }

  // Extract data from results
  const { responses = [], total_questions, answered_questions, average_score } = interviewState.results;

  // Group responses by question type for analysis
  const questionTypeGroups = responses.reduce((groups, response) => {
    const type = response.question_type || 'general';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(response);
    return groups;
  }, {});

  // Calculate average scores by question type
  const typeScores = Object.entries(questionTypeGroups).map(([type, typeResponses]) => {
    const sum = typeResponses.reduce((total, r) => total + parseFloat(r.evaluation), 0);
    const average = sum / typeResponses.length;
    return { type, average, count: typeResponses.length };
  });

  // Get the maximum and minimum scored questions
  const sortedByScore = [...responses].sort((a, b) => parseFloat(b.evaluation) - parseFloat(a.evaluation));
  const bestQuestion = sortedByScore[0];
  const worstQuestion = sortedByScore[sortedByScore.length - 1];

  // Render tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="text-gray-500 mb-1">Average Score</h4>
                <p className="text-3xl font-bold">{average_score}/10</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="text-gray-500 mb-1">Questions Answered</h4>
                <p className="text-3xl font-bold">{answered_questions}/{total_questions}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="text-gray-500 mb-1">Completion</h4>
                <p className="text-3xl font-bold">{Math.round((answered_questions / total_questions) * 100)}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="font-semibold mb-3">Strongest Response</h4>
                {bestQuestion ? (
                  <>
                    <p className="text-sm text-gray-600 mb-1">Score: {bestQuestion.evaluation}/10</p>
                    <p className="font-medium mb-2">Q: {bestQuestion.question}</p>
                    <p className="text-sm bg-gray-50 p-2 rounded">A: {bestQuestion.answer}</p>
                  </>
                ) : (
                  <p className="text-gray-500">No responses found</p>
                )}
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="font-semibold mb-3">Needs Improvement</h4>
                {worstQuestion ? (
                  <>
                    <p className="text-sm text-gray-600 mb-1">Score: {worstQuestion.evaluation}/10</p>
                    <p className="font-medium mb-2">Q: {worstQuestion.question}</p>
                    <p className="text-sm bg-gray-50 p-2 rounded">A: {worstQuestion.answer}</p>
                  </>
                ) : (
                  <p className="text-gray-500">No responses found</p>
                )}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow mb-6">
              <h4 className="font-semibold mb-3">Performance by Question Type</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {typeScores.map((typeData) => (
                  <div key={typeData.type} className="bg-gray-50 p-3 rounded">
                    <h5 className="capitalize">{typeData.type} Questions</h5>
                    <p className="text-lg font-bold">{typeData.average.toFixed(1)}/10</p>
                    <p className="text-xs text-gray-500">Based on {typeData.count} questions</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
        
      case 'responses':
        return (
          <div>
            <h3 className="text-xl font-bold mb-4">Your Answers</h3>
            {responses.map((r, index) => (
              <div key={index} className="mb-4 p-4 bg-white shadow rounded-lg">
                <div className="flex justify-between">
                  <p className="font-semibold mb-1">Q{index + 1}: {r.question}</p>
                  <div className={`px-2 py-1 rounded text-sm ${
                    parseFloat(r.evaluation) >= 8 ? 'bg-green-100 text-green-800' :
                    parseFloat(r.evaluation) >= 5 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {r.evaluation}/10
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">Question Type: {r.question_type || 'General'}</p>
                <p className="bg-gray-50 p-3 rounded mb-2"><strong>Your Answer:</strong> {r.answer}</p>
              </div>
            ))}
          </div>
        );
        
      default:
        return <p>No content available for this tab.</p>;
    }
  };

  return (
    <div className="results-display container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Interview Results</h2>
      
      {/* Tab navigation */}
      <div className="mb-6 border-b">
        <div className="flex">
          <button
            className={`py-2 px-4 font-medium ${activeTab === 'overview' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`py-2 px-4 font-medium ${activeTab === 'responses' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('responses')}
          >
            All Responses
          </button>
        </div>
      </div>
      
      {/* Tab content */}
      {renderTabContent()}
      
      {/* Action buttons */}
      <div className="mt-6">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded mr-3"
          onClick={handleRestart}
        >
          Start New Interview
        </button>
        
        <button
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
          onClick={() => window.print()}
        >
          Print Results
        </button>
      </div>
    </div>
  );
};

export default ResultsDisplay;