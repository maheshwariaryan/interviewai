// ✅ Updated ResumeUpload.js - stores session ID and kicks off interview
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
      console.log("UPLOAD RESPONSE:", result);
      console.log("SESSION ID FROM BACKEND", result.session_id);
      const sessionId = result.session_id;
      localStorage.setItem('interview_session_id', sessionId); // 🔐 Save session ID

      setUploadProgress(90);
      setStatusMessage(`Generated ${result.question_count} questions.`);
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
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-4">
          <label className="block mb-2 font-medium">Job Role:</label>
          <input type="text" className="w-full p-2 border rounded" value={role} onChange={handleRoleChange} required />
        </div>
        <div className="mb-4">
          <label className="block mb-2 font-medium">Upload Resume (PDF only):</label>
          <input type="file" accept=".pdf" onChange={handleFileChange} className="block" required disabled={isUploading} />
          {file && <p className="mt-2 text-sm text-green-600">Selected file: {file.name}</p>}
        </div>
        <button
          type="submit"
          className={`px-4 py-2 rounded font-medium ${
            isUploading ? 'bg-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          disabled={isUploading || !file}
        >
          {isUploading ? 'Processing...' : 'Upload & Start Interview'}
        </button>
        {statusMessage && <p className="mt-4 text-sm text-gray-700">{statusMessage}</p>}
      </form>
    </div>
  );
};

export default ResumeUpload;
