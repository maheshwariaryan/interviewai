// src/components/InterviewSetup.js
import React, { useState, useEffect } from 'react';
import { useInterview } from '../context/InterviewContext';
import { generateQuestions } from '../services/api';

const InterviewSetup = ({ onComplete }) => {
  const { 
    resumeData, 
    setInterviewSetup, 
    updateInterviewStatus, 
    setError 
  } = useInterview();
  
  const [role, setRole] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showDetails, setShowDetails] = useState({
    skills: false,
    experience: false,
    education: false,
    certifications: false
  });
  const [roleOptions, setRoleOptions] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');

  // Suggest role options based on resume content
  useEffect(() => {
    if (resumeData.extracted) {
      const suggestedRoles = extractPossibleRoles(resumeData);
      setRoleOptions(suggestedRoles);
    }
  }, [resumeData]);

  // Simulate progress updates during question generation
  useEffect(() => {
    let progressInterval;
    
    if (isGenerating && generationProgress < 90) {
      progressInterval = setInterval(() => {
        setGenerationProgress((prevProgress) => {
          // Slowly increment progress to simulate AI processing
          if (prevProgress < 20) {
            setStatusMessage('Analyzing job role requirements...');
            return prevProgress + 2;
          }
          if (prevProgress < 40) {
            setStatusMessage('Evaluating resume against job requirements...');
            return prevProgress + 1.5;
          }
          if (prevProgress < 60) {
            setStatusMessage('Identifying key areas to assess in interview...');
            return prevProgress + 1;
          }
          if (prevProgress < 80) {
            setStatusMessage('Generating tailored interview questions...');
            return prevProgress + 0.5;
          }
          return prevProgress;
        });
      }, 400);
    }
    
    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isGenerating, generationProgress]);

  // Extract possible roles from resume data
  const extractPossibleRoles = (resumeData) => {
    const roles = [];
    
    if (!resumeData.extracted) return roles;
    
    // Extract from experience
    if (resumeData.extracted.experience) {
      const experienceText = resumeData.extracted.experience.toLowerCase();
      const jobTitles = experienceText.match(/(\w+\s+)?(developer|engineer|manager|analyst|designer|specialist|consultant|administrator|director|coordinator|associate|assistant|intern)\b/gi) || [];
      
      jobTitles.forEach(title => {
        if (title && !roles.includes(title.trim())) {
          roles.push(title.trim());
        }
      });
    }
    
    // Extract from skills
    if (resumeData.extracted.skills) {
      const skillsText = resumeData.extracted.skills.toLowerCase();
      
      const techRoles = ['software developer', 'web developer', 'frontend developer', 'backend developer', 'full stack developer', 'data scientist', 'data analyst'];
      
      for (const role of techRoles) {
        // Check if skills suggest this role
        if (
          (role.includes('data') && (skillsText.includes('python') || skillsText.includes('r ') || skillsText.includes('statistics') || skillsText.includes('sql'))) ||
          (role.includes('web') && (skillsText.includes('html') || skillsText.includes('css') || skillsText.includes('javascript'))) ||
          (role.includes('frontend') && (skillsText.includes('react') || skillsText.includes('angular') || skillsText.includes('vue'))) ||
          (role.includes('backend') && (skillsText.includes('node') || skillsText.includes('express') || skillsText.includes('django') || skillsText.includes('laravel'))) ||
          (role.includes('full') && (skillsText.includes('react') && (skillsText.includes('node') || skillsText.includes('express'))))
        ) {
          if (!roles.includes(role)) {
            roles.push(role);
          }
        }
      }
    }
    
    // Remove duplicates and ensure unique values
    return Array.from(new Set(roles)).slice(0, 5);
  };

  // Handle input change
  const handleRoleChange = (e) => {
    setRole(e.target.value);
  };

  // Handle role suggestion selection
  const handleRoleSuggestionClick = (suggestedRole) => {
    setRole(suggestedRole);
  };

  // Toggle section visibility
  const toggleSection = (section) => {
    setShowDetails(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!role) {
      setError('Please enter a job role');
      return;
    }
    
    if (!resumeData.content || !resumeData.extracted) {
      setError('Please upload a resume first');
      return;
    }
    
    try {
      setIsGenerating(true);
      setGenerationProgress(5);
      updateInterviewStatus('preparing');
      setStatusMessage('Initializing interview preparation...');
      
      // Set up interview configuration with all available data
      const config = {
        role,
        resume: resumeData.content,
        skills: resumeData.extracted.skills || '',
        experience: resumeData.extracted.experience || '',
        education: resumeData.extracted.education || '',
        certifications: resumeData.extracted.certifications || '',
        years_experience: resumeData.extracted.years_of_experience || 0
      };
      
      // Update interview setup
      setInterviewSetup(config);
      
      // Generate interview questions
      const result = await generateQuestions(config);
      
      // Set final progress states
      setGenerationProgress(100);
      setStatusMessage('Interview questions ready!');
      
      // Check if questions were generated
      if (!result || !result.total_questions) {
        throw new Error('Failed to generate interview questions');
      }
      
      // Short delay to show completion state
      setTimeout(() => {
        // Call completion callback
        if (onComplete) {
          onComplete();
        }
      }, 1000);
      
    } catch (error) {
      console.error('Interview setup error:', error);
      setError(error.message);
      setStatusMessage(`Error: ${error.message}`);
      updateInterviewStatus('idle');
      setGenerationProgress(0);
    } finally {
      setIsGenerating(false);
    }
  };

  // Format section content for display
  const formatContent = (content) => {
    if (!content) return 'None detected';
    
    // Split by line breaks
    return content.split('\n').map((line, index) => 
      line.trim() ? <p key={index} className="mb-1">{line}</p> : null
    );
  };

  // Render extracted resume data
  const renderExtractedData = () => {
    if (!resumeData.extracted) return null;
    
    const { skills, experience, education, certifications, years_of_experience, num_certifications } = resumeData.extracted;
    
    return (
      <div className="mt-6 bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-blue-50 p-4 border-b">
          <h3 className="text-lg font-bold text-blue-800">Resume Analysis Results</h3>
          <p className="text-sm text-gray-600">File: {resumeData.originalFile || 'Uploaded resume'}</p>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 p-3 rounded">
              <p className="font-medium">Experience</p>
              <p className="text-2xl font-bold">{years_of_experience || 0} years</p>
            </div>
            <div className="bg-blue-50 p-3 rounded">
              <p className="font-medium">Certifications</p>
              <p className="text-2xl font-bold">{num_certifications || 0}</p>
            </div>
          </div>
          
          <div className="mt-4 border-t pt-4">
            <div className="mb-4">
              <div 
                className="flex justify-between items-center cursor-pointer bg-gray-100 p-3 rounded" 
                onClick={() => toggleSection('skills')}
              >
                <h4 className="font-bold">Skills</h4>
                <span>{showDetails.skills ? '▼' : '►'}</span>
              </div>
              {showDetails.skills && (
                <div className="mt-2 p-3 bg-gray-50 rounded">
                  {formatContent(skills)}
                </div>
              )}
            </div>
            
            <div className="mb-4">
              <div 
                className="flex justify-between items-center cursor-pointer bg-gray-100 p-3 rounded" 
                onClick={() => toggleSection('experience')}
              >
                <h4 className="font-bold">Experience</h4>
                <span>{showDetails.experience ? '▼' : '►'}</span>
              </div>
              {showDetails.experience && (
                <div className="mt-2 p-3 bg-gray-50 rounded">
                  {formatContent(experience)}
                </div>
              )}
            </div>
            
            <div className="mb-4">
              <div 
                className="flex justify-between items-center cursor-pointer bg-gray-100 p-3 rounded" 
                onClick={() => toggleSection('education')}
              >
                <h4 className="font-bold">Education</h4>
                <span>{showDetails.education ? '▼' : '►'}</span>
              </div>
              {showDetails.education && (
                <div className="mt-2 p-3 bg-gray-50 rounded">
                  {formatContent(education)}
                </div>
              )}
            </div>
            
            {certifications && (
              <div className="mb-4">
                <div 
                  className="flex justify-between items-center cursor-pointer bg-gray-100 p-3 rounded" 
                  onClick={() => toggleSection('certifications')}
                >
                  <h4 className="font-bold">Certifications</h4>
                  <span>{showDetails.certifications ? '▼' : '►'}</span>
                </div>
                {showDetails.certifications && (
                  <div className="mt-2 p-3 bg-gray-50 rounded">
                    {formatContent(certifications)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="interview-setup container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Set Up Your Interview</h2>
      
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md mb-6">
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
          
          {roleOptions.length > 0 && (
            <div className="mt-2">
              <label className="text-sm text-gray-600">Suggested roles based on your resume:</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {roleOptions.map((suggestedRole, index) => (
                  <button
                    key={index}
                    type="button"
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200"
                    onClick={() => handleRoleSuggestionClick(suggestedRole)}
                  >
                    {suggestedRole}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {isGenerating && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${generationProgress}%` }}
              ></div>
            </div>
            <p className="text-sm mt-1 text-gray-600">{statusMessage} ({Math.round(generationProgress)}%)</p>
          </div>
        )}
        
        <button
          type="submit"
          className={`px-4 py-2 rounded font-medium ${
            isGenerating 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating Questions...' : 'Start Interview'}
        </button>
      </form>
      
      {renderExtractedData()}
    </div>
  );
};

export default InterviewSetup;