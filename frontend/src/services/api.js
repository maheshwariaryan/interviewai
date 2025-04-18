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
 * @returns {Promise} - The current question and remaining count
 */
export const getCurrentQuestion = async () => {
  try {
    console.log("API: Getting current question");
    const response = await fetch(`${API_BASE_URL}/get-question`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response from get-question:", errorText);
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("API: Question data received:", data);
    return data;
  } catch (error) {
    console.error('Get question error:', error);
    throw error;
  }
};

/**
 * Submit a response to the current question
 * @param {string} response - The user's response to the question
 * @returns {Promise} - Evaluation of the response
 */
export const submitResponse = async (response) => {
  if (!response || response.trim() === '') {
    throw new Error('No response provided');
  }
  
  try {
    console.log("API: Submitting response:", response.substring(0, 50) + "...");
    const apiResponse = await fetch(`${API_BASE_URL}/submit-response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ response }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error("Error response from submit-response:", errorText);
      throw new Error(`Server error: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    const data = await apiResponse.json();
    console.log("API: Response submitted, evaluation:", data);
    return data;
  } catch (error) {
    console.error('Submit response error:', error);
    throw error;
  }
};

/**
 * Get the complete interview results
 * @returns {Promise} - Complete interview results
 */
export const getInterviewResults = async () => {
  try {
    console.log("API: Getting interview results");
    const response = await fetch(`${API_BASE_URL}/get-results`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response from get-results:", errorText);
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("API: Results received");
    return data;
  } catch (error) {
    console.error('Get results error:', error);
    throw error;
  }
};