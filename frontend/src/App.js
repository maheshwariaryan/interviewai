// src/App.js
import React, { useState } from 'react';
import { InterviewProvider } from './context/InterviewContext';
import ResumeUpload from './components/ResumeUpload';
import VoiceInterviewer from './components/VoiceInterviewer';
import ResultsDisplay from './components/ResultsDisplay';
import ErrorBoundary from './components/ErrorBoundary';
import './styles.css';

const App = () => {
  const [step, setStep] = useState('upload'); // upload, interview, results

  // Navigation handlers
  const goToUpload = () => setStep('upload');
  const goToInterview = () => setStep('interview');
  const goToResults = () => setStep('results');
  const restartInterview = () => {
    setStep('upload');
  };

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 'upload':
        return <ResumeUpload onComplete={goToInterview} />;
      case 'interview':
        return <VoiceInterviewer onComplete={goToResults} />;
      case 'results':
        return <ResultsDisplay onRestart={restartInterview} />;
      default:
        return <ResumeUpload onComplete={goToInterview} />;
    }
  };

  return (
    <ErrorBoundary>
      <InterviewProvider>
        <div className="app min-h-screen bg-gray-50">
          <header className="bg-blue-700 text-white p-4">
            <div className="container mx-auto">
              <h1 className="text-3xl font-bold">Mock Interview AI</h1>
              <p className="mt-2">Practice your interview skills with AI-powered feedback</p>
            </div>
          </header>

          <nav className="bg-blue-800 text-white p-2">
            <div className="container mx-auto">
              <ul className="flex">
                <li className={`mr-4 cursor-pointer ${step === 'upload' ? 'font-bold' : ''}`}>
                  1. Upload Resume
                </li>
                <li className={`mr-4 cursor-pointer ${step === 'interview' ? 'font-bold' : ''}`}>
                  2. Interview
                </li>
                <li className={`cursor-pointer ${step === 'results' ? 'font-bold' : ''}`}>
                  3. Results
                </li>
              </ul>
            </div>
          </nav>

          <main className="py-6">
            {renderStep()}
          </main>

          <footer className="bg-gray-800 text-white p-4 mt-8">
            <div className="container mx-auto text-center">
              <p>&copy; {new Date().getFullYear()} Mock Interview AI</p>
            </div>
          </footer>
        </div>
      </InterviewProvider>
    </ErrorBoundary>
  );
};

export default App;