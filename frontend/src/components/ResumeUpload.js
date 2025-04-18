// src/components/ResumeUpload.js
import React, { useState, useEffect } from 'react';
import { useInterview } from '../context/InterviewContext';
import { getCurrentQuestion } from '../services/api';

// N8N webhook URL
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_ENV_URL;

const ResumeUpload = ({ onComplete }) => {
  const { setResumeData, setError, updateInterviewStatus, setInterviewSetup } = useInterview();
  const [file, setFile] = useState(null);
  const [role, setRole] = useState('Software Developer'); // Default role
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  // Handle file input change
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Only accept PDF files
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setStatusMessage('');
      } else {
        setFile(null);
        setError('Please upload a PDF file only');
        setStatusMessage('Error: Only PDF files are accepted');
      }
    }
  };

  // Handle role input change
  const handleRoleChange = (e) => {
    setRole(e.target.value);
  };

  // Verify questions are ready
  const verifyQuestionsReady = async () => {
    try {
      // Try to get the first question to verify questions are generated
      const questionResponse = await getCurrentQuestion();
      
      // If we got a valid question, questions are ready
      if (questionResponse.question && 
          questionResponse.question !== 'No questions available. Please generate questions first.') {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error verifying questions:', error);
      return false;
    }
  };

  // Handle resume submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please upload a PDF resume file');
      return;
    }
    
    try {
      setIsUploading(true);
      setStatusMessage('Uploading resume to processing service...');
      setUploadProgress(5);
      
      // Create FormData to send the file and role
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('role', role); // Include the role in the form data
      
      setUploadProgress(15);
      setStatusMessage('Processing PDF...');
      
      // Send to N8N for processing
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        body: formData,
      });
      
      setUploadProgress(70);
      setStatusMessage('Analyzing resume content and generating questions...');
      
      if (!response.ok) {
        throw new Error(`Failed to process resume: ${response.status} ${response.statusText}`);
      }
      
      // Get the processed data
      const result = await response.json();
      
      if (!result || !result.success) {
        throw new Error('The processing service did not return a valid response');
      }
      
      setUploadProgress(90);
      setStatusMessage('Preparing interview questions...');
      
      // Save the role in interview context
      setInterviewSetup({
        role: role
      });
      
      // Update interview status to preparing
      updateInterviewStatus('preparing');
      
      // Save the resume data
      setResumeData({
        role: role,
        originalFile: file.name,
      });

      // Wait briefly to ensure questions are generated and available
      setTimeout(async () => {
        const questionsReady = await verifyQuestionsReady();
        
        if (questionsReady) {
          setUploadProgress(100);
          setStatusMessage('Interview ready! Starting now...');
          
          // Short delay to show completion before moving to next step
          setTimeout(() => {
            updateInterviewStatus('interviewing');
            // Call completion callback
            if (onComplete) {
              onComplete();
            }
          }, 1000);
        } else {
          throw new Error('Interview questions could not be generated. Please try again.');
        }
      }, 2000); // Give backend a couple seconds to finish generating questions
      
    } catch (error) {
      console.error('Resume upload error:', error);
      setError(error.message);
      setStatusMessage(`Error: ${error.message}`);
      setUploadProgress(0);
      updateInterviewStatus('idle');
    } finally {
      // Don't set isUploading to false until we're done with everything
      // This prevents premature state updates
    }
  };

  return (
    <div className="resume-upload container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Upload Your Resume</h2>
      
      <div className="mb-6 p-4 bg-blue-50 rounded">
        <h3 className="text-lg font-semibold mb-2">Instructions</h3>
        <ul className="list-disc pl-5">
          <li>Upload your resume in PDF format</li>
          <li>Select the job role you're applying for</li>
          <li>The system will generate interview questions based on your resume and the selected role</li>
        </ul>
      </div>
      
      <div className="mb-4">
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
          {/* Role selection field */}
          <div className="mb-4">
            <label className="block mb-2 font-medium">Job Role:</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={role}
              onChange={handleRoleChange}
              placeholder="Enter the job role you're applying for"
              required
            />
          </div>
          
          {/* File upload field */}
          <div className="mb-4">
            <label className="block mb-2 font-medium">Upload Resume (PDF only):</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="resume-upload"
                required={true}
                disabled={isUploading}
              />
              <label 
                htmlFor="resume-upload" 
                className="cursor-pointer flex flex-col items-center justify-center"
              >
                <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                <span className="text-sm text-gray-600">
                  {file ? file.name : 'Click to browse or drag & drop your PDF resume'}
                </span>
              </label>
            </div>
            {file && <p className="mt-2 text-sm text-green-600">Selected file: {file.name}</p>}
          </div>
          
          {isUploading && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm mt-1 text-gray-600">{statusMessage} ({Math.round(uploadProgress)}%)</p>
            </div>
          )}
          
          {statusMessage && !isUploading && (
            <div className={`mb-4 text-sm ${statusMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {statusMessage}
            </div>
          )}
          
          <button
            type="submit"
            className={`px-4 py-2 rounded font-medium ${
              isUploading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : file 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={isUploading || !file}
          >
            {isUploading ? 'Processing...' : 'Upload & Process Resume'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResumeUpload;