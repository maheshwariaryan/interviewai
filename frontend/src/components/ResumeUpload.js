// src/components/ResumeUpload.js
import React, { useState } from 'react';
import { useInterview } from '../context/InterviewContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const ResumeUpload = ({ onComplete }) => {
  const { setResumeData, setError, updateInterviewStatus, setInterviewSetup } = useInterview();
  const [file, setFile] = useState(null);
  const [role, setRole] = useState('Software Developer');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
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

  const handleRoleChange = (e) => {
    setRole(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError('Please upload a resume file');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(10);
      setStatusMessage('Uploading and processing resume...');

      const formData = new FormData();
      formData.append('resume', file);
      formData.append('role', role);

      const response = await fetch(`${API_BASE_URL}/upload-resume`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();

      setUploadProgress(90);
      setStatusMessage(`Generated ${result.question_count} questions.`);

      // Save data
      setInterviewSetup({ role });
      updateInterviewStatus('interviewing');
      setResumeData({ role, originalFile: file.name });

      setTimeout(() => {
        setUploadProgress(100);
        setStatusMessage('Interview ready!');
        onComplete?.();
      }, 1000);
    } catch (error) {
      console.error('Resume upload error:', error);
      setError(error.message);
      setStatusMessage(`Error: ${error.message}`);
      setUploadProgress(0);
      updateInterviewStatus('idle');
    }
  };

  return (
    <div className="resume-upload container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Upload Your Resume</h2>

      <div className="mb-6 p-4 bg-blue-50 rounded">
        <h3 className="text-lg font-semibold mb-2">Instructions</h3>
        <ul className="list-disc pl-5">
          <li>Upload a PDF resume</li>
          <li>Select the job role</li>
          <li>We’ll generate tailored interview questions</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-4">
          <label className="block mb-2 font-medium">Job Role:</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            value={role}
            onChange={handleRoleChange}
            placeholder="Enter the job role"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block mb-2 font-medium">Upload Resume (PDF only):</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              id="resume-upload"
              required
              disabled={isUploading}
            />
            <label htmlFor="resume-upload" className="cursor-pointer flex flex-col items-center justify-center">
              <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
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
          {isUploading ? 'Processing...' : 'Upload & Start Interview'}
        </button>
      </form>
    </div>
  );
};

export default ResumeUpload;
