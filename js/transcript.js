// Transcript management system with Whisper integration
class TranscriptManager {
  constructor() {
    this.proceedingId = null;
    this.proceedingData = null;
    this.transcriptContent = '';
    this.isRecording = false;
    this.isPaused = false;
    this.saveInterval = null;
    this.lastSaveTime = null;
    
    // WebSocket connection for real-time transcription
    this.socket = null;
    this.isConnected = false;
    // Set default values instead of dynamic selection
    this.selectedDevice = null; // Use default device
    this.modelSize = 'base'; // Default model
    this.language = 'en'; // Default language
    
    this.initializeElements();
    this.setupEventListeners();
    this.initializeFromElectron();
    // Initialize WebSocket after a small delay to ensure DOM is ready
    setTimeout(() => this.initializeWebSocket(), 100);
  }

  initializeElements() {
    // Case info elements
    this.caseNumberTop = document.getElementById('case-number-top');
    this.caseTitleLine = document.getElementById('case-title-line');
    this.caseTypeLine = document.getElementById('case-type-line');
    this.chargesLine = document.getElementById('charges-line');
    this.judgeLine = document.getElementById('judge-line');
    this.clerkLine = document.getElementById('clerk-line');
    this.sessionDateLine = document.getElementById('session-date-line');
    
    // Control elements
    this.startBtn = document.getElementById('start-btn');
    this.pauseBtn = document.getElementById('pause-btn');
    this.restartBtn = document.getElementById('restart-btn');
    this.statusDot = document.getElementById('status-dot');
    this.statusText = document.getElementById('status-text');
    
    // Transcript elements
    this.transcriptTextarea = document.getElementById('transcript-content');
    this.lastSavedSpan = document.getElementById('last-saved');
    this.autoSaveStatus = document.getElementById('auto-save-status');
  }

  setupEventListeners() {
    this.startBtn.addEventListener('click', () => {
      if (this.isPaused) {
        this.resumeTranscription();
      } else {
        this.startTranscription();
      }
    });
    this.pauseBtn.addEventListener('click', () => this.pauseTranscription());
    this.restartBtn.addEventListener('click', () => this.restartTranscription());
    
    // Auto-save on content change (for manual edits if needed)
    this.transcriptTextarea.addEventListener('input', () => {
      this.transcriptContent = this.transcriptTextarea.value;
      this.debounceAutoSave();
    });
  }

  initializeFromElectron() {
    // Listen for proceeding ID from Electron main process
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.onLoadProceeding((proceedingId) => {
        this.proceedingId = proceedingId;
        this.loadProceedingData();
      });
    } else {
      // Fallback for development - extract from URL or prompt user
      const urlParams = new URLSearchParams(window.location.search);
      this.proceedingId = urlParams.get('proceedingId');
      
      if (!this.proceedingId) {
        this.showError('No proceeding ID provided. Please access this page through the proper navigation.');
        return;
      }
      
      this.loadProceedingData();
    }
  }

  async loadProceedingData() {
    try {
      this.showLoading(true);
      
      const response = await fetch(`http://localhost:5001/api/proceeding/${this.proceedingId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch proceeding data: ${response.status}`);
      }
      
      this.proceedingData = await response.json();
      this.populateCaseInformation();
      this.loadExistingTranscript();
      
    } catch (error) {
      console.error('Error loading proceeding data:', error);
      this.showError('Failed to load case information. Please try again.');
    } finally {
      this.showLoading(false);
    }
  }

  populateCaseInformation() {
    if (!this.proceedingData) return;

    const data = this.proceedingData;
    
    // Set case number at top
    this.caseNumberTop.textContent = `Case No ${data.case_number || '-'}`;
    
    // Set main case title
    const plaintiff = `${data.plaintiff?.appelation || ''} ${data.plaintiff?.name || ''}`.trim();
    const defendant = `${data.defendant?.appelation || ''} ${data.defendant?.name || ''}`.trim();
    const caseTitle = `${plaintiff} Vs ${defendant}`;
    const charges = data.charges ? `(${data.charges})` : '';
    this.caseTitleLine.textContent = `${caseTitle} ${charges}`;
    
    // Set court composition
    const judgeName = data.judge_name || data.judge_matricule || 'Unknown Judge';
    this.judgeLine.textContent = `${judgeName} - President;`;
    
    const clerkName = data.clerk_name || data.clerk_matricule || 'Unknown Clerk';
    this.clerkLine.textContent = `${clerkName} - Clerk;`;
    
    // Set case details
    this.caseTypeLine.textContent = data.case_type ? data.case_type.charAt(0).toUpperCase() + data.case_type.slice(1) : '-';
    this.chargesLine.textContent = data.charges || '-';
    
    // Format and set session date
    if (data.schedule_datetime) {
      const date = new Date(data.schedule_datetime);
      this.sessionDateLine.textContent = date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  async loadExistingTranscript() {
    try {
      const response = await fetch(`http://localhost:5001/api/transcript/${this.proceedingId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.content) {
          this.transcriptContent = data.content;
          this.transcriptTextarea.value = data.content;
          this.lastSaveTime = new Date(data.last_modified);
          this.updateLastSavedTime();
        }
      }
    } catch (error) {
      console.log('No existing transcript found, starting fresh');
    }
  }

  startTranscription() {
    // Check if we have Whisper integration available
    if (this.isConnected && this.socket) {
      this.startWhisperTranscription();
    } else {
      this.startBasicTranscription();
    }
  }

  startWhisperTranscription() {
    if (!this.proceedingId) {
      this.showError('No proceeding ID available. Please reload the page.');
      return;
    }

    this.isRecording = true;
    this.isPaused = false;
    
    // Update UI
    this.startBtn.disabled = true;
    this.pauseBtn.disabled = false;
    this.restartBtn.disabled = false;
    this.transcriptTextarea.readOnly = true; // Keep readonly for Whisper input
    
    this.updateStatus('recording', 'Starting Whisper transcription...');
    
    // Start real-time Whisper transcription
    this.socket.emit('start_transcription', {
      proceeding_id: this.proceedingId,
      model_size: this.modelSize,
      language: this.language
    });
    
    // Start auto-save interval
    this.startAutoSave();
    
    console.log('Whisper transcription started for proceeding:', this.proceedingId);
  }

  startBasicTranscription() {
    this.isRecording = true;
    this.isPaused = false;
    
    // Update UI
    this.startBtn.disabled = true;
    this.pauseBtn.disabled = false;
    this.restartBtn.disabled = false;
    this.transcriptTextarea.readOnly = false;
    
    this.updateStatus('recording', 'Recording in progress (manual mode)...');
    
    // Start auto-save interval
    this.startAutoSave();
    
    // Focus on textarea for input
    this.transcriptTextarea.focus();
    
    console.log('Basic transcription started for proceeding:', this.proceedingId);
  }

  pauseTranscription() {
    if (this.isConnected && this.socket) {
      // Pause Whisper transcription
      this.socket.emit('pause_transcription', {
        proceeding_id: this.proceedingId
      });
    }

    this.isPaused = true;
    
    // Update UI
    this.startBtn.disabled = false;
    this.startBtn.textContent = 'Resume';
    this.pauseBtn.disabled = true;
    
    this.updateStatus('paused', 'Transcription paused');
    
    // Stop auto-save temporarily
    this.stopAutoSave();
    
    console.log('Transcription paused');
  }

  restartTranscription() {
    // Show confirmation dialog
    const confirmed = confirm('Are you sure you want to restart the transcription? This will clear all current content.');
    
    if (confirmed) {
      // Stop current transcription if running
      if (this.isRecording && this.isConnected && this.socket) {
        this.socket.emit('stop_transcription', {
          proceeding_id: this.proceedingId
        });
      }

      this.isRecording = false;
      this.isPaused = false;
      this.transcriptContent = '';
      this.transcriptTextarea.value = '';
      
      // Reset UI
      this.startBtn.disabled = false;
      this.startBtn.textContent = 'Start';
      this.pauseBtn.disabled = true;
      this.restartBtn.disabled = true;
      this.transcriptTextarea.readOnly = true;
      
      this.updateStatus('ready', 'Ready to start');
      this.stopAutoSave();
      
      console.log('Transcription restarted');
    }
  }

  resumeTranscription() {
    if (this.isConnected && this.socket) {
      if (this.isPaused && this.isRecording) {
        this.socket.emit('resume_transcription', {
          proceeding_id: this.proceedingId
        });
        
        console.log('Resuming Whisper transcription');
      } else {
        // Start new transcription
        this.startTranscription();
      }
    } else {
      // Resume basic transcription
      this.isPaused = false;
      this.startBtn.disabled = true;
      this.startBtn.textContent = 'Start';
      this.pauseBtn.disabled = false;
      this.transcriptTextarea.readOnly = false;
      this.updateStatus('recording', 'Recording in progress (manual mode)...');
      this.startAutoSave();
      this.transcriptTextarea.focus();
    }
  }

  initializeWebSocket() {
    try {
      // Check if Socket.IO is available
      if (typeof io === 'undefined') {
        console.warn('Socket.IO not available, using basic mode');
        this.isConnected = false;
        this.updateStatus('ready', 'Ready to start transcription (basic mode)');
        return;
      }
      
      // Initialize Socket.IO connection
      this.socket = io('http://localhost:5001');
      
      // Connection events
      this.socket.on('connect', () => {
        console.log('Connected to transcription server');
        this.isConnected = true;
        this.updateStatus('ready', 'Connected - Ready to start transcription');
        
        // Request available audio devices
        this.socket.emit('get_audio_devices');
      });
      
      this.socket.on('disconnect', () => {
        console.log('Disconnected from transcription server');
        this.isConnected = false;
        this.updateStatus('ready', 'Ready to start transcription (basic mode)');
      });
      
      // Transcription events
      this.socket.on('transcription_started', (data) => {
        console.log('Transcription started:', data);
        this.updateStatus('recording', `Recording with ${data.model_size} model (${data.language})`);
      });
      
      this.socket.on('transcript_update', (data) => {
        // Real-time transcript updates from Whisper
        console.log('Transcript update:', data.text);
        
        // Append new text to the transcript
        if (data.text && data.text.trim()) {
          this.transcriptContent = data.full_transcript;
          this.transcriptTextarea.value = this.transcriptContent;
          
          // Auto-scroll to bottom
          this.transcriptTextarea.scrollTop = this.transcriptTextarea.scrollHeight;
          
          // Trigger auto-save
          this.debounceAutoSave();
        }
      });
      
      this.socket.on('transcription_paused', (data) => {
        console.log('Transcription paused:', data);
        this.updateStatus('paused', 'Whisper transcription paused');
      });
      
      this.socket.on('transcription_resumed', (data) => {
        console.log('Transcription resumed:', data);
        this.updateStatus('recording', 'Whisper transcription resumed');
        
        // Update pause button to resume
        if (this.isPaused) {
          this.isPaused = false;
          this.startBtn.disabled = true;
          this.pauseBtn.disabled = false;
          this.startAutoSave();
        }
      });
      
      this.socket.on('transcription_stopped', (data) => {
        console.log('Transcription stopped:', data);
        this.isRecording = false;
        this.isPaused = false;
        
        // Reset UI
        this.startBtn.disabled = false;
        this.startBtn.textContent = 'Start';
        this.pauseBtn.disabled = true;
        this.restartBtn.disabled = true;
        
        this.updateStatus('ready', 'Transcription completed and saved');
        this.stopAutoSave();
      });
      
      this.socket.on('audio_devices', (data) => {
        console.log('Available audio devices:', data.devices);
        // Audio devices received but using default device
      });
      
      this.socket.on('error', (data) => {
        console.error('Transcription error:', data.message);
        this.showError(`Transcription error: ${data.message}`);
        
        // Reset recording state on error
        this.isRecording = false;
        this.isPaused = false;
        this.startBtn.disabled = false;
        this.startBtn.textContent = 'Start';
        this.pauseBtn.disabled = true;
        this.updateStatus('error', data.message);
      });
      
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      this.isConnected = false;
      this.updateStatus('ready', 'Ready to start transcription (basic mode)');
    }
  }
  


  updateStatus(status, text) {
    if (this.statusDot) {
      this.statusDot.className = `status-dot ${status}`;
    }
    if (this.statusText) {
      this.statusText.textContent = text;
    }
  }

  startAutoSave() {
    // Save every 10 seconds
    this.saveInterval = setInterval(() => {
      this.saveTranscript();
    }, 10000);
  }

  stopAutoSave() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }

  debounceAutoSave() {
    // Debounce auto-save to avoid too frequent requests
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      this.saveTranscript();
    }, 2000);
  }

  async saveTranscript() {
    if (!this.transcriptContent.trim()) return;
    
    try {
      const response = await fetch(`http://localhost:5001/api/transcript/${this.proceedingId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: this.transcriptContent,
          proceeding_id: this.proceedingId
        })
      });
      
      if (response.ok) {
        this.lastSaveTime = new Date();
        this.updateLastSavedTime();
        console.log('Transcript saved successfully');
      } else {
        console.error('Failed to save transcript');
      }
    } catch (error) {
      console.error('Error saving transcript:', error);
    }
  }

  updateLastSavedTime() {
    if (this.lastSaveTime && this.lastSavedSpan) {
      this.lastSavedSpan.textContent = `Last saved: ${this.lastSaveTime.toLocaleTimeString()}`;
    }
  }

  showLoading(show) {
    const elements = [this.caseNumberTop, this.caseTitleLine, this.caseTypeLine, this.chargesLine, this.judgeLine, this.clerkLine, this.sessionDateLine];
    elements.forEach(el => {
      if (el) {
        if (show) {
          el.classList.add('loading');
          el.textContent = 'Loading...';
        } else {
          el.classList.remove('loading');
        }
      }
    });
  }

  showError(message) {
    if (this.caseTitleLine) {
      this.caseTitleLine.textContent = message;
      this.caseTitleLine.style.color = '#dc3545';
    }
  }
}

// Initialize the transcript manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.transcriptManager = new TranscriptManager();
});

// Handle Electron IPC if available
if (typeof window !== 'undefined' && window.require) {
  const { ipcRenderer } = window.require('electron');
  
  // Listen for proceeding data from main process
  ipcRenderer.on('load-proceeding', (event, proceedingId) => {
    if (window.transcriptManager) {
      window.transcriptManager.proceedingId = proceedingId;
      window.transcriptManager.loadProceedingData();
    }
  });
} 