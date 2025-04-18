// src/services/speechService.js

/**
 * Text-to-speech service that reads text aloud
 */
export class SpeechSynthesisService {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    
    // Load available voices
    this.loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = this.loadVoices.bind(this);
    }
  }

  loadVoices() {
    this.voices = this.synth.getVoices();
  }

  /**
   * Speak the given text
   * @param {string} text - Text to be spoken
   * @param {Function} onEnd - Callback when speech ends
   */
  speak(text, onEnd = () => {}) {
    // Cancel any ongoing speech
    this.cancel();

    // Create a new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select a voice (prefer English voices)
    const englishVoices = this.voices.filter(voice => 
      voice.lang.includes('en-') && !voice.name.includes('Google')
    );
    
    if (englishVoices.length > 0) {
      utterance.voice = englishVoices[0];
    }
    
    // Set properties
    utterance.pitch = 1;
    utterance.rate = 1;
    utterance.volume = 1;
    
    // Set callback for when speech ends
    utterance.onend = onEnd;
    
    // Set error callback
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      // Still call onEnd in case of error to not block the UI
      onEnd();
    };
    
    // Start speaking
    this.synth.speak(utterance);
  }

  /**
   * Cancel ongoing speech
   */
  cancel() {
    this.synth.cancel();
  }

  /**
   * Check if speech synthesis is speaking
   * @returns {boolean} - True if speaking
   */
  isSpeaking() {
    return this.synth.speaking;
  }
}

/**
 * Speech recognition service that converts speech to text
 */
export class SpeechRecognitionService {
  constructor() {
    // Initialize SpeechRecognition with browser prefixes
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported in this browser');
    }
    
    // Available accent options
    this.accentOptions = [
      { code: 'en-US', name: 'American English' },
      { code: 'en-GB', name: 'British English' },
      { code: 'en-IN', name: 'Indian English' },
      { code: 'en-AU', name: 'Australian English' },
      { code: 'en-ZA', name: 'South African English' },
      { code: 'en-NZ', name: 'New Zealand English' }
    ];
    
    this.recognition = new SpeechRecognition();
    this.isListening = false;
    this.transcript = '';
    this.fullTranscript = ''; // Store the full transcript across recognition sessions
    this.isRestarting = false; // Flag to track if we're in the restart process
    
    // Configure recognition
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US'; // Default language
    
    // Set up event handlers
    this.recognition.onresult = this.handleResult.bind(this);
    this.recognition.onerror = this.handleError.bind(this);
    this.recognition.onend = this.handleEnd.bind(this);
    
    // Callbacks
    this.onTranscriptChange = null;
    this.onEnd = null;
    this.onError = null;
  }

  /**
   * Get available accent options
   * @returns {Array} - List of available accent options
   */
  getAccentOptions() {
    return this.accentOptions;
  }

  /**
   * Set the recognition language/accent
   * @param {string} languageCode - Language code (e.g., 'en-US', 'en-GB')
   */
  setAccent(languageCode) {
    // Validate the language code
    const isValidCode = this.accentOptions.some(option => option.code === languageCode);
    if (isValidCode) {
      this.recognition.lang = languageCode;
      console.log(`Accent set to ${languageCode}`);
      
      // Restart recognition if currently listening
      if (this.isListening) {
        // We need to properly stop before restarting
        this.isRestarting = true;
        this.softStop(() => {
          this.isRestarting = false;
          this.start(this.onTranscriptChange, this.onEnd, this.onError);
        });
      }
      
      return true;
    }
    return false;
  }

  /**
   * Handle speech recognition results - FIXED to prevent clearing text
   * @param {Event} event - Recognition result event
   */
  handleResult(event) {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }
    
    // Add final transcript to the full transcript
    if (finalTranscript) {
      this.fullTranscript += finalTranscript + ' ';
    }
    
    // Use the full transcript as the main transcript
    this.transcript = this.fullTranscript;
    
    if (this.onTranscriptChange) {
      this.onTranscriptChange(this.transcript, interimTranscript);
    }
  }

  /**
   * Handle speech recognition errors
   * @param {Event} event - Recognition error event
   */
  handleError(event) {
    console.error('Speech recognition error:', event.error);
    
    // Don't try to restart if we're already restarting
    if (this.isRestarting) {
      return;
    }
    
    if (this.onError) {
      this.onError(event.error);
    }
    
    // Properly clean up after errors
    this.isListening = false;
  }

  /**
   * Handle speech recognition end
   */
  handleEnd() {
    // If we're in the process of restarting, don't interfere
    if (this.isRestarting) {
      return;
    }
    
    // If we're still supposed to be listening, restart
    if (this.isListening) {
      console.log('Recognition ended, attempting to restart...');
      
      // Set restarting flag to prevent multiple restarts
      this.isRestarting = true;
      
      // Ensure we wait before trying to restart
      setTimeout(() => {
        try {
          // Only try to start if we should still be listening
          if (this.isListening) {
            this.recognition.start();
            console.log('Recognition restarted successfully');
          }
        } catch (error) {
          console.error('Error restarting speech recognition:', error);
          if (this.onError) {
            this.onError('Failed to restart speech recognition. Try stopping and starting again.');
          }
          this.isListening = false;
        } finally {
          this.isRestarting = false;
        }
      }, 300);
    } else if (this.onEnd) {
      // If we've explicitly stopped, call onEnd
      this.onEnd(this.transcript);
    }
  }

  /**
   * Soft stop - stop and then call a callback
   * @param {Function} callback - Function to call after stopping
   */
  softStop(callback) {
    // Set flag to prevent auto-restart
    this.isRestarting = true;
    
    try {
      this.recognition.stop();
      // Wait for the recognition to fully stop
      setTimeout(() => {
        if (callback) callback();
      }, 200);
    } catch (error) {
      console.error('Error in soft stop:', error);
      this.isRestarting = false;
      if (callback) callback();
    }
  }

  /**
   * Start listening for speech
   * @param {Function} onTranscriptChange - Callback when transcript changes
   * @param {Function} onEnd - Callback when recognition ends
   * @param {Function} onError - Callback when an error occurs
   */
  start(onTranscriptChange, onEnd, onError) {
    // If already listening, don't try to start again
    if (this.isListening || this.isRestarting) {
      console.log('Recognition already active, not starting again');
      return;
    }
    
    // Save callbacks
    this.onTranscriptChange = onTranscriptChange;
    this.onEnd = onEnd;
    this.onError = onError;
    
    // Reset full transcript if we're starting fresh
    this.fullTranscript = '';
    
    try {
      this.recognition.start();
      this.isListening = true;
      console.log('Speech recognition started');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      if (onError) {
        onError(error.message || 'Error starting speech recognition');
      }
    }
  }

  /**
   * Stop listening for speech
   */
  stop() {
    if (this.isListening) {
      // Set flag first to prevent automatic restart
      this.isListening = false;
      
      try {
        this.recognition.stop();
        console.log('Speech recognition stopped');
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  }

  /**
   * Check if recognition is listening
   * @returns {boolean} - True if listening
   */
  isRecognitionActive() {
    return this.isListening;
  }
}