// src/context/InterviewContext.js
import React, { createContext, useState, useContext } from 'react';

// Create context
const InterviewContext = createContext();

// Context provider component
export const InterviewProvider = ({ children }) => {
  // Interview state
  const [resumeData, setResumeData] = useState({
    content: '',
    extracted: null,
    role: '',
    originalFile: ''
  });
  
  const [interviewSetup, setInterviewSetup] = useState({
    role: '',
    resumeContent: '',
    skills: '',
    experience: '',
    education: '',
  });
  
  const [interviewState, setInterviewState] = useState({
    status: 'idle', // idle, preparing, interviewing, completed
    currentQuestion: '',
    currentQuestionType: '',
    currentQuestionIndex: 0,
    totalQuestions: 0,
    remainingQuestions: 0,
    responses: [],
    results: null,
    error: null,
    loading: false
  });

  // Reset interview state
  const resetInterview = () => {
    setInterviewState({
      status: 'idle',
      currentQuestion: '',
      currentQuestionType: '',
      currentQuestionIndex: 0,
      totalQuestions: 0,
      remainingQuestions: 0,
      responses: [],
      results: null,
      error: null,
      loading: false
    });
  };

  // Update interview status
  const updateInterviewStatus = (status) => {
    setInterviewState((prev) => ({ ...prev, status }));
  };

  // Set loading state
  const setLoading = (loading) => {
    setInterviewState((prev) => ({ ...prev, loading }));
  };

  // Set current question
  const setCurrentQuestion = (question, remaining, index, questionType = 'general') => {
    setInterviewState((prev) => ({
      ...prev,
      currentQuestion: question,
      currentQuestionType: questionType,
      remainingQuestions: remaining,
      currentQuestionIndex: index !== undefined ? index : prev.currentQuestionIndex + 1,
      totalQuestions: remaining + (index !== undefined ? index : prev.currentQuestionIndex + 1) + 1
    }));
  };

  // Add a response
  const addResponse = (question, answer, evaluation, questionType = 'general') => {
    setInterviewState((prev) => ({
      ...prev,
      responses: [
        ...prev.responses,
        { question, answer, evaluation, questionType },
      ],
    }));
  };

  // Set interview results
  const setResults = (results) => {
    setInterviewState((prev) => ({
      ...prev,
      results,
      status: 'completed',
    }));
  };

  // Set error
  const setError = (error) => {
    setInterviewState((prev) => ({
      ...prev,
      error,
    }));
  };

  // Context value
  const value = {
    resumeData,
    setResumeData,
    interviewSetup,
    setInterviewSetup,
    interviewState,
    resetInterview,
    updateInterviewStatus,
    setCurrentQuestion,
    addResponse,
    setResults,
    setError,
    setLoading
  };

  return (
    <InterviewContext.Provider value={value}>
      {children}
    </InterviewContext.Provider>
  );
};

// Custom hook to use the context
export const useInterview = () => {
  const context = useContext(InterviewContext);
  if (!context) {
    throw new Error('useInterview must be used within an InterviewProvider');
  }
  return context;
};