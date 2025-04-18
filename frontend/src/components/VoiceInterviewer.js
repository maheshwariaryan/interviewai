// src/components/VoiceInterviewer.js
import React, { useState, useEffect, useRef } from 'react';
import { useInterview } from '../context/InterviewContext';
import { SpeechSynthesisService, SpeechRecognitionService } from '../services/speechService';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

const VoiceInterviewer = ({ onComplete }) => {
  const {
    interviewState,
    updateInterviewStatus,
    setCurrentQuestion,
    addResponse,
    setError,
    setLoading
  } = useInterview();

  // Speech services
  const [speechSynthesis, setSpeechSynthesis] = useState(null);
  const [speechRecognition, setSpeechRecognition] = useState(null);
  
  // State for transcript and speech
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState('');
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionFetched, setQuestionFetched] = useState(false);
  const [accentOptions, setAccentOptions] = useState([]);
  const [selectedAccent, setSelectedAccent] = useState('en-US');
  const [showAccentOptions, setShowAccentOptions] = useState(false);

  // Get session ID from localStorage
  const sessionId = localStorage.getItem('interview_session_id');

  // Initialize speech services
  useEffect(() => {
    try {
      // Initialize speech synthesis
      const synthService = new SpeechSynthesisService();
      setSpeechSynthesis(synthService);
      
      // Initialize speech recognition if available
      try {
        const recognitionService = new SpeechRecognitionService();
        setSpeechRecognition(recognitionService);
        setAccentOptions(recognitionService.getAccentOptions());
      } catch (error) {
        console.error("Speech recognition initialization error:", error);
        setSpeechError("Speech recognition is not available in your browser.");
      }
    } catch (error) {
      console.error("Speech synthesis initialization error:", error);
      setSpeechError("Speech synthesis is not available in your browser.");
    }
  }, []);

  // Check session and load first question on mount
  useEffect(() => {
    if (!sessionId) {
      setError("Session ID missing. Please restart the interview.");
      return;
    }
    
    updateInterviewStatus('interviewing');
    fetchNextQuestion();
  }, []);

  // Read question aloud when it changes
  useEffect(() => {
    if (speechSynthesis && interviewState.currentQuestion && !isSpeaking && questionFetched) {
      readQuestionAloud();
    }
  }, [interviewState.currentQuestion, speechSynthesis, questionFetched]);

  // Fetch the next question from the API
  const fetchNextQuestion = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/get-question?session_id=${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();

      if (result.question && result.question !== 'No questions available.') {
        setCurrentQuestion(result.question, result.remaining, result.question_index, result.question_type);
        setQuestionFetched(true);
      } else if (result.remaining === 0) {
        updateInterviewStatus('completed');
        onComplete?.();
      } else {
        setError('No interview questions found. Make sure to upload your resume first.');
      }
    } catch (err) {
      console.error('Error fetching question:', err);
      setError('Failed to fetch interview question. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  // Read the current question aloud
  const readQuestionAloud = () => {
    if (speechSynthesis && interviewState.currentQuestion) {
      setIsSpeaking(true);
      speechSynthesis.speak(interviewState.currentQuestion, () => {
        setIsSpeaking(false);
      });
    }
  };

  // Toggle speech recognition on/off
  const toggleListening = () => {
    if (!speechRecognition) {
      setSpeechError("Speech recognition is not available in your browser.");
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Start speech recognition
  const startListening = () => {
    setIsListening(true);
    
    // Set up callbacks
    speechRecognition.start(
      // onTranscriptChange
      (fullText, interim) => {
        setTranscript(fullText);
        setInterimTranscript(interim);
      },
      // onEnd
      (finalText) => {
        setIsListening(false);
        setTranscript(finalText);
      },
      // onError
      (error) => {
        setIsListening(false);
        setSpeechError(`Speech recognition error: ${error}`);
      }
    );
  };

  // Stop speech recognition
  const stopListening = () => {
    if (speechRecognition) {
      speechRecognition.stop();
      setIsListening(false);
    }
  };

  // Change speech recognition accent
  const changeAccent = (accentCode) => {
    if (speechRecognition) {
      speechRecognition.setAccent(accentCode);
      setSelectedAccent(accentCode);
      setShowAccentOptions(false);
    }
  };

  // Handle manual text input change
  const handleInputChange = (e) => {
    setTranscript(e.target.value);
  };

  // Submit user's response to the current question
  const handleSubmitResponse = async () => {
    if (!transcript.trim()) {
      setError('Please provide a response before submitting.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Stop any active speech or listening
      if (speechSynthesis && isSpeaking) {
        speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      
      if (speechRecognition && isListening) {
        stopListening();
      }

      // Submit the response to the API
      const response = await fetch(`${API_BASE_URL}/submit-response?session_id=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: transcript })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();

      // Add the response to our state
      addResponse(
        interviewState.currentQuestion,
        transcript,
        result.evaluation,
        result.question_type || 'general'
      );

      // Clear the transcript for the next question
      setTranscript('');
      setInterimTranscript('');

      // Check if interview is complete
      if (result.interview_complete) {
        updateInterviewStatus('completed');
        onComplete?.();
      } else {
        // Fetch the next question
        fetchNextQuestion();
      }
    } catch (error) {
      console.error('Submit response error:', error);
      setError('Failed to submit your answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Skip current question
  const handleSkipQuestion = async () => {
    try {
      setIsSubmitting(true);
      
      // Submit empty response to skip
      const response = await fetch(`${API_BASE_URL}/submit-response?session_id=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: "I'm skipping this question." })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();

      // Check if interview is complete
      if (result.interview_complete) {
        updateInterviewStatus('completed');
        onComplete?.();
      } else {
        // Fetch the next question
        fetchNextQuestion();
      }

      // Clear the transcript
      setTranscript('');
      setInterimTranscript('');
      
    } catch (error) {
      console.error('Skip question error:', error);
      setError('Failed to skip question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (interviewState.loading || !questionFetched) {
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
      
      {/* Progress indicator */}
      <div className="mb-4 bg-blue-50 p-3 rounded">
        <p className="text-sm text-blue-800">
          Question {interviewState.currentQuestionIndex + 1} of {interviewState.totalQuestions}
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
          <div 
            className="bg-blue-600 h-2 rounded-full" 
            style={{ width: `${((interviewState.currentQuestionIndex + 1) / interviewState.totalQuestions) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Current question */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-bold">Current Question:</h3>
          
          {/* Voice controls */}
          <div className="flex gap-2">
            {speechSynthesis && (
              <button
                type="button"
                onClick={readQuestionAloud}
                disabled={isSpeaking}
                className={`p-2 rounded ${isSpeaking ? 'bg-gray-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                title="Read question aloud"
              >
                <span role="img" aria-label="Speak">🔊</span>
              </button>
            )}
            
            {/* Accent selector */}
            {speechRecognition && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAccentOptions(!showAccentOptions)}
                  className="p-2 bg-gray-200 hover:bg-gray-300 rounded"
                  title="Change accent"
                >
                  <span role="img" aria-label="Accent">🌐</span>
                </button>
                
                {showAccentOptions && (
                  <div className="absolute right-0 mt-1 bg-white border rounded shadow-lg z-10 w-48">
                    {accentOptions.map(option => (
                      <button
                        key={option.code}
                        onClick={() => changeAccent(option.code)}
                        className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${
                          selectedAccent === option.code ? 'bg-blue-50 font-semibold' : ''
                        }`}
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 bg-gray-100 rounded text-lg">
          {interviewState.currentQuestion}
        </div>
      </div>

      {/* Voice input controls */}
      {speechRecognition && (
        <div className="mb-4 flex gap-3">
          <button
            type="button"
            onClick={toggleListening}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              isListening 
                ? 'bg-red-600 hover:bg-red-700 text-white microphone-active' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            <span role="img" aria-label="Microphone">{isListening ? '🎙️' : '🎤'}</span>
            {isListening ? 'Stop Recording' : 'Start Recording'}
          </button>
          
          {speechError && (
            <div className="text-red-600 text-sm flex items-center">
              <span>{speechError}</span>
            </div>
          )}
        </div>
      )}

      {/* Response textarea */}
      <div className="mb-6">
        <label className="block mb-2 font-medium">Your Answer:</label>
        <textarea
          value={transcript}
          onChange={handleInputChange}
          className="w-full p-4 bg-gray-100 rounded min-h-20 border-2 border-blue-300 focus:border-blue-500 focus:outline-none"
          placeholder="Type or speak your answer here..."
          rows={6}
        />
        
        {interimTranscript && (
          <div className="mt-2 p-2 bg-gray-50 text-gray-500 italic">
            {interimTranscript}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          className={`px-4 py-2 rounded ${
            isSubmitting || (!transcript.trim() && !isListening)
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
          onClick={handleSubmitResponse}
          disabled={isSubmitting || (!transcript.trim() && !isListening)}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Answer'}
        </button>
        
        <button
          type="button"
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
          onClick={handleSkipQuestion}
          disabled={isSubmitting}
        >
          Skip Question
        </button>
      </div>
    </div>
  );
};

export default VoiceInterviewer;