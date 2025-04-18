// src/components/VoiceInterviewer.js
import React, { useState, useEffect, useRef } from 'react';
import { useInterview } from '../context/InterviewContext';
import { getCurrentQuestion, submitResponse } from '../services/api';
import { SpeechSynthesisService, SpeechRecognitionService } from '../services/speechService';

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
    isReading: false,
    isListening: false,
    transcript: '',
    interimTranscript: '',
    errorMessage: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retries, setRetries] = useState(0);
  const [questionFetched, setQuestionFetched] = useState(false);
  const [accentOptions, setAccentOptions] = useState([]);
  const [selectedAccent, setSelectedAccent] = useState('en-US');
  const [textInputMode, setTextInputMode] = useState(false);
  const textInputRef = useRef(null);

  // References for speech services
  const speechSynthRef = useRef(null);
  const speechRecogRef = useRef(null);

  // Initialize speech services
  useEffect(() => {
    try {
      speechSynthRef.current = new SpeechSynthesisService();
      speechRecogRef.current = new SpeechRecognitionService();
      
      // Get available accent options after initializing speech recognition
      if (speechRecogRef.current) {
        setAccentOptions(speechRecogRef.current.getAccentOptions());
      }
    } catch (error) {
      console.error('Error initializing speech services:', error);
      setError('Speech services not supported in this browser. Try using Google Chrome.');
      setTextInputMode(true);
    }

    // Clean up
    return () => {
      if (speechSynthRef.current) {
        speechSynthRef.current.cancel();
      }
      if (speechRecogRef.current) {
        speechRecogRef.current.stop();
      }
    };
  }, [setError]);

  // Focus text input when switching to text mode
  useEffect(() => {
    if (textInputMode && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textInputMode]);

  // Fetch questions when component mounts
  useEffect(() => {
    console.log("Voice Interviewer mounted, interview status:", interviewState.status);
    updateInterviewStatus('interviewing');
    fetchNextQuestion();
  }, []);

  // Retry logic for fetching questions
  useEffect(() => {
    if (retries > 0 && !questionFetched && retries < 5) {
      const timeoutId = setTimeout(() => {
        console.log(`Retry attempt ${retries} to fetch question...`);
        fetchNextQuestion();
      }, 2000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [retries, questionFetched]);

  // Handle accent changes
  const handleAccentChange = (e) => {
    const newAccent = e.target.value;
    setSelectedAccent(newAccent);
    
    if (speechRecogRef.current) {
      speechRecogRef.current.setAccent(newAccent);
    }
  };

  // Handle text input change
  const handleTextInputChange = (e) => {
    setSpeechState(prev => ({
      ...prev,
      transcript: e.target.value,
    }));
  };

  // Toggle between voice and text input
  const toggleInputMode = () => {
    if (speechState.isListening) {
      stopListening();
    }
    setTextInputMode(!textInputMode);
  };

  // Fetch the next question
  const fetchNextQuestion = async () => {
    try {
      setLoading(true);
      console.log("Fetching next question...");
      
      // Get the next question
      const result = await getCurrentQuestion();
      console.log("Question API response:", result);
      
      if (result.question && result.question !== 'No questions available. Please generate questions first.') {
        // Update current question in context
        setCurrentQuestion(
          result.question,
          result.remaining,
          result.question_index || 0,
          result.question_type || 'general'
        );
        
        setQuestionFetched(true);
        setLoading(false);
        
        // Automatically read the question aloud
        readQuestionAloud(result.question);
      } else if (result.remaining === 0 && interviewState.currentQuestionIndex > 0) {
        // No more questions and we've answered at least one, interview is complete
        console.log("No more questions, completing interview");
        if (onComplete) {
          onComplete();
        }
      } else {
        // Retry logic
        console.log("Failed to get questions, retrying...");
        setRetries(prev => prev + 1);
        setLoading(false);
        
        if (retries >= 4) {
          throw new Error('Failed to get interview questions after multiple attempts. Please try again.');
        }
      }
    } catch (error) {
      console.error('Fetch question error:', error);
      setError(`Error getting interview questions: ${error.message}`);
      setLoading(false);
    }
  };

  // Read the question aloud
  const readQuestionAloud = (question) => {
    if (!speechSynthRef.current || !question) return;
    
    setSpeechState(prev => ({ ...prev, isReading: true }));
    console.log("Reading question aloud:", question);
    
    // Start speaking
    speechSynthRef.current.speak(question, () => {
      setSpeechState(prev => ({ ...prev, isReading: false }));
      // Automatically start listening after reading the question if not in text mode
      if (!textInputMode) {
        startListening();
      }
    });
  };

  // Start listening for user's response
  const startListening = () => {
    if (!speechRecogRef.current) {
      setTextInputMode(true);
      return;
    }
    
    // Don't clear previous transcript if already listening
    // Only clear errorMessage
    setSpeechState(prev => ({
      ...prev,
      isListening: true,
      errorMessage: '',
      // Keep the transcript and only clear interimTranscript
      interimTranscript: '',
    }));
    
    console.log("Starting speech recognition...");
    
    // Start recognition
    speechRecogRef.current.start(
      // On transcript change
      (finalTranscript, interimTranscript) => {
        setSpeechState(prev => ({
          ...prev,
          transcript: finalTranscript,
          interimTranscript,
        }));
      },
      
      // On end
      (finalTranscript) => {
        setSpeechState(prev => ({
          ...prev,
          isListening: false,
          transcript: finalTranscript,
        }));
        console.log("Speech recognition ended, transcript:", finalTranscript);
      },
      
      // On error
      (error) => {
        setSpeechState(prev => ({
          ...prev,
          isListening: false,
          errorMessage: `Speech recognition error: ${error}. You can try another accent or switch to text input.`,
        }));
        console.error("Speech recognition error:", error);
      }
    );
  };

  // Stop listening
  const stopListening = () => {
    if (!speechRecogRef.current) return;
    
    speechRecogRef.current.stop();
    setSpeechState(prev => ({ ...prev, isListening: false }));
    console.log("Stopped speech recognition");
  };

  // Submit the response
  const handleSubmitResponse = async () => {
    try {
      if (!speechState.transcript.trim()) {
        setError('Please provide a response');
        return;
      }
      
      // Stop listening if still active
      if (speechState.isListening) {
        stopListening();
      }
      
      console.log("Submitting response:", speechState.transcript);
      setIsSubmitting(true);
      
      // Submit the response
      const result = await submitResponse(speechState.transcript);
      console.log("Response submission result:", result);
      
      // Add the response to the interview state
      addResponse(
        interviewState.currentQuestion,
        speechState.transcript,
        result.evaluation,
        result.question_type || interviewState.currentQuestionType
      );
      
      // Clear transcript
      setSpeechState(prev => ({
        ...prev,
        transcript: '',
        interimTranscript: '',
      }));
      
      // Reset for next question
      setQuestionFetched(false);
      setRetries(0);
      setTextInputMode(false);
      
      // Check if interview is complete
      if (result.interview_complete) {
        console.log("Interview complete, going to results");
        // Go to results
        updateInterviewStatus('completed');
        if (onComplete) {
          onComplete();
        }
      } else {
        // Fetch the next question
        console.log("Fetching next question...");
        fetchNextQuestion();
      }
    } catch (error) {
      console.error('Submit response error:', error);
      setError(`Error submitting your answer: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Re-read the current question
  const handleRereadQuestion = () => {
    if (speechState.isReading) {
      // Cancel current speech
      if (speechSynthRef.current) {
        speechSynthRef.current.cancel();
      }
      setSpeechState(prev => ({ ...prev, isReading: false }));
    } else {
      // Start reading again
      readQuestionAloud(interviewState.currentQuestion);
    }
  };

  // Render accent selector
  const renderAccentSelector = () => {
    if (accentOptions.length === 0) return null;
    
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select your accent:
        </label>
        <select
          value={selectedAccent}
          onChange={handleAccentChange}
          className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          disabled={speechState.isListening}
        >
          {accentOptions.map(option => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // Render buttons based on current state
  const renderControls = () => {
    return (
      <div className="flex flex-wrap mt-4">
        {/* Question control */}
        <button
          type="button"
          className={`px-4 py-2 mr-2 mb-2 rounded ${speechState.isReading ? 'bg-red-500' : 'bg-blue-600'} text-white`}
          onClick={handleRereadQuestion}
        >
          {speechState.isReading ? 'Stop Reading' : 'Read Question Again'}
        </button>
        
        {!textInputMode ? (
          <>
            {/* Microphone control */}
            <button
              type="button"
              className={`px-4 py-2 mr-2 mb-2 rounded ${speechState.isListening ? 'bg-red-500' : 'bg-green-600'} text-white`}
              onClick={speechState.isListening ? stopListening : startListening}
              disabled={isSubmitting || interviewState.loading}
            >
              {speechState.isListening ? 'Stop Recording' : 'Start Recording'}
            </button>
            
            {/* Toggle to text input */}
            <button
              type="button"
              className="px-4 py-2 mr-2 mb-2 rounded bg-gray-600 text-white"
              onClick={toggleInputMode}
              disabled={isSubmitting}
            >
              Switch to Text Input
            </button>
          </>
        ) : (
          /* Toggle to voice input */
          <button
            type="button"
            className="px-4 py-2 mr-2 mb-2 rounded bg-gray-600 text-white"
            onClick={toggleInputMode}
            disabled={isSubmitting}
          >
            Switch to Voice Input
          </button>
        )}
        
        {/* Submit control */}
        <button
          type="button"
          className={`px-4 py-2 mb-2 rounded ${
            isSubmitting || (!speechState.transcript.trim()) || (speechState.isListening && !textInputMode) || interviewState.loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700'
          } text-white`}
          onClick={handleSubmitResponse}
          disabled={isSubmitting || (!speechState.transcript.trim()) || (speechState.isListening && !textInputMode) || interviewState.loading}
        >
          {isSubmitting ? 'Processing...' : 'Submit & Continue'}
        </button>
      </div>
    );
  };

  // Render current progress
  const renderProgress = () => {
    return (
      <div className="mb-4">
        <p>
          Question {interviewState.currentQuestionIndex + 1} of {interviewState.totalQuestions || 'multiple'}
          {interviewState.currentQuestionType && (
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full capitalize">
              {interviewState.currentQuestionType}
            </span>
          )}
        </p>
        <div className="w-full bg-gray-200 rounded h-2 mt-2">
          <div
            className="bg-blue-600 h-2 rounded"
            style={{
              width: interviewState.totalQuestions 
                ? `${((interviewState.currentQuestionIndex + 1) / interviewState.totalQuestions) * 100}%`
                : '0%',
            }}
          ></div>
        </div>
      </div>
    );
  };

  // Show loading state
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
      
      {renderAccentSelector()}
      {renderProgress()}
      
      <div className="mb-4">
        <h3 className="text-xl font-bold mb-2">Current Question:</h3>
        <p className="p-4 bg-gray-100 rounded">{interviewState.currentQuestion}</p>
      </div>
      
      <div className="mb-4">
        <h3 className="text-xl font-bold mb-2">Your Answer:</h3>
        
        {textInputMode ? (
          <textarea
            ref={textInputRef}
            value={speechState.transcript}
            onChange={handleTextInputChange}
            className="w-full p-4 bg-gray-100 rounded min-h-20 border-2 border-blue-300 focus:border-blue-500 focus:outline-none"
            placeholder="Type your answer here..."
            rows={6}
          />
        ) : (
          <div className={`p-4 bg-gray-100 rounded min-h-20 ${speechState.isListening ? 'border-2 border-green-500 shadow-md' : ''}`}>
            {speechState.transcript || speechState.interimTranscript || (
              speechState.isListening ? 
                'Listening... Speak your answer.' : 
                'Click "Start Recording" to begin your answer.'
            )}
          </div>
        )}
        
        {speechState.errorMessage && (
          <div className="mt-2 p-3 bg-red-50 text-red-700 rounded border border-red-200">
            <p>{speechState.errorMessage}</p>
          </div>
        )}
      </div>
      
      {renderControls()}
      
      <div className="mt-4">
        {textInputMode ? (
          <p className="text-sm text-gray-600">
            Type your answer in the text box above, then click "Submit & Continue" when finished.
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            {speechState.isListening ? 
              'Listening... Speak clearly and at a normal pace.' : 
              'Click "Start Recording" when you are ready to answer the question, then click "Submit & Continue" when finished.'}
          </p>
        )}
      </div>
    </div>
  );
};

export default VoiceInterviewer;