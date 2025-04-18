// ✅ Full VoiceInterviewer.js with session ID support
import React, { useState, useEffect, useRef } from 'react';
import { useInterview } from '../context/InterviewContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const VoiceInterviewer = ({ onComplete }) => {
  const {
    interviewState,
    updateInterviewStatus,
    setCurrentQuestion,
    addResponse,
    setError,
    setLoading
  } = useInterview();

  const [speechState, setSpeechState] = useState({
    transcript: '',
    isListening: false,
    errorMessage: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionFetched, setQuestionFetched] = useState(false);

  const sessionId = localStorage.getItem('interview_session_id');

  useEffect(() => {
    const sessionId = localStorage.getItem("interview_session_id");
    console.log("Loaded sessionId:", sessionId);

    if (!sessionId) {
      setError("Session ID missing. Please restart the interview.");
      return;
    }
    updateInterviewStatus('interviewing');
    fetchNextQuestion();
  }, []);

  const fetchNextQuestion = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/get-question?session_id=${sessionId}`);
      const result = await response.json();

      if (result.question && result.question !== 'No questions available. Please generate questions first.') {
        setCurrentQuestion(result.question, result.remaining, result.question_index, result.question_type);
        setQuestionFetched(true);
      } else if (result.remaining === 0) {
        updateInterviewStatus('completed');
        onComplete?.();
      } else {
        setError('No interview questions found.');
      }
    } catch (err) {
      console.error('Error fetching question:', err);
      setError('Failed to fetch interview question.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setSpeechState({ ...speechState, transcript: e.target.value });
  };

  const handleSubmitResponse = async () => {
    if (!speechState.transcript.trim()) {
      setError('Please provide a response');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/submit-response?session_id=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: speechState.transcript })
      });

      const result = await response.json();

      addResponse(
        interviewState.currentQuestion,
        speechState.transcript,
        result.evaluation,
        result.question_type || 'general'
      );

      setSpeechState({ transcript: '', isListening: false, errorMessage: '' });

      if (result.interview_complete) {
        updateInterviewStatus('completed');
        onComplete?.();
      } else {
        fetchNextQuestion();
      }
    } catch (error) {
      console.error('Submit response error:', error);
      setError('Failed to submit your answer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (interviewState.loading || !interviewState.currentQuestion) {
    return (
      <div className="voice-interviewer container mx-auto p-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Preparing Your Interview</h2>
        <div className="spinner mb-4"></div>
        <p>Loading interview questions...</p>
      </div>
    );
  }

  return (
    <div className="voice-interviewer container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Interview in Progress</h2>

      <div className="mb-4">
        <h3 className="text-xl font-bold mb-2">Current Question:</h3>
        <p className="p-4 bg-gray-100 rounded">{interviewState.currentQuestion}</p>
      </div>

      <div className="mb-4">
        <textarea
          value={speechState.transcript}
          onChange={handleInputChange}
          className="w-full p-4 bg-gray-100 rounded min-h-20 border-2 border-blue-300 focus:border-blue-500 focus:outline-none"
          placeholder="Type your answer here..."
          rows={6}
        />
        {speechState.errorMessage && (
          <div className="mt-2 p-3 bg-red-50 text-red-700 rounded border border-red-200">
            <p>{speechState.errorMessage}</p>
          </div>
        )}
      </div>

      <button
        type="button"
        className={`px-4 py-2 mb-2 rounded ${
          isSubmitting || !speechState.transcript.trim()
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-purple-600 hover:bg-purple-700 text-white'
        }`}
        onClick={handleSubmitResponse}
        disabled={isSubmitting || !speechState.transcript.trim()}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Answer'}
      </button>
    </div>
  );
};

export default VoiceInterviewer;
