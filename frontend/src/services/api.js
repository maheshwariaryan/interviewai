// src/services/api.js
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

/**
 * Handle API errors in a consistent way
 * @param {Response} response - Fetch response object
 * @returns {Promise} - Parsed JSON or thrown error
 */
const handleResponse = async (response) => {
  if (!response.ok) {
    let errorMessage;
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || `Server error: ${response.status}`;
    } catch (e) {
      errorMessage = `Server error: ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }
  
  return await response.json();
};

/**
 * Get the current interview question
 * @param {string} sessionId - The session ID for this interview
 * @returns {Promise} - The current question and remaining count
 */
export const getCurrentQuestion = async (sessionId) => {
  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  try {
    console.log("API: Getting current question for session:", sessionId);
    const response = await fetch(`${API_BASE_URL}/get-question?session_id=${sessionId}`);
    return handleResponse(response);
  } catch (error) {
    console.error('Get question error:', error);
    throw error;
  }
};

/**
 * Submit a response to the current question
 * @param {string} response - The user's response to the question
 * @param {string} sessionId - The session ID for this interview
 * @returns {Promise} - Evaluation of the response
 */
export const submitResponse = async (response, sessionId) => {
  if (!response || response.trim() === '') {
    throw new Error('No response provided');
  }
  
  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  try {
    console.log("API: Submitting response for session:", sessionId);
    const apiResponse = await fetch(`${API_BASE_URL}/submit-response?session_id=${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ response }),
    });

    return handleResponse(apiResponse);
  } catch (error) {
    console.error('Submit response error:', error);
    throw error;
  }
};

/**
 * Get the complete interview results
 * @param {string} sessionId - The session ID for this interview
 * @returns {Promise} - Complete interview results
 */
export const getInterviewResults = async (sessionId) => {
  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  try {
    console.log("API: Getting interview results for session:", sessionId);
    const response = await fetch(`${API_BASE_URL}/get-results?session_id=${sessionId}`);
    return handleResponse(response);
  } catch (error) {
    console.error('Get results error:', error);
    throw error;
  }
};

/**
 * Generate interview questions based on resume and job role
 * @param {object} config - Configuration for question generation
 * @returns {Promise} - Question generation result
 */
export const generateQuestions = async (config) => {
  try {
    console.log("API: Generating interview questions");
    const response = await fetch(`${API_BASE_URL}/generate-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    return handleResponse(response);
  } catch (error) {
    console.error('Generate questions error:', error);
    throw error;
  }
};