// Simple Transcript Manager - No WebSocket dependencies
class SimpleTranscriptManager {
  constructor() {
    this.proceedingId = null;
    this.proceedingData = null;
    this.transcriptContent = '';
    this.isRecording = false;
    this.isPaused = false;
    this.sessionId = null;
    this.eventSource = null;
    this.mediaRecorder = null;
    this.audioStream = null;
    this.audioChunks = [];
    
    this.initializeElements();
    this.setupEventListeners();
    this.initializeFromElectron();
  }

  initializeElements() {
    // Control buttons
    this.startBtn = document.getElementById('start-btn');
    this.pauseBtn = document.getElementById('pause-btn');
    this.restartBtn = document.getElementById('restart-btn');
    
    // Content elements
    this.transcriptTextarea = document.getElementById('transcript-content');
    this.caseNumberTop = document.getElementById('case-number-top');
    this.caseTitleLine = document.getElementById('case-title-line');
    this.caseTypeLine = document.getElementById('case-type-line');
    this.chargesLine = document.getElementById('charges-line');
    this.judgeLine = document.getElementById('judge-line');
    this.clerkLine = document.getElementById('clerk-line');
    this.sessionDateLine = document.getElementById('session-date-line');
    
    // Status elements
    this.statusElements = {
      statusDot: document.getElementById('status-dot'),
      statusText: document.getElementById('status-text')
    };
    
    // Auto-save elements
    this.lastSavedSpan = document.getElementById('last-saved');
    this.autoSaveStatus = document.getElementById('auto-save-status');
  }

  setupEventListeners() {
    this.startBtn.addEventListener('click', () => this.startTranscription());
    this.pauseBtn.addEventListener('click', () => this.pauseTranscription());
    this.restartBtn.addEventListener('click', () => this.restartTranscription());
  }

  initializeFromElectron() {
    console.log('=== Initializing transcript manager ===');
    console.log('Window object available:', typeof window !== 'undefined');
    console.log('electronAPI available:', !!window.electronAPI);
    console.log('require available:', !!window.require);
    
    // Try to get proceeding ID from URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    this.proceedingId = urlParams.get('proceeding_id');
    console.log('Proceeding ID from URL:', this.proceedingId);
    
    if (this.proceedingId) {
      console.log('Loading proceeding data from URL parameter');
      this.loadProceedingData();
    } else {
      // Wait for Electron IPC if no URL parameter
      console.log('No URL parameter, waiting for proceeding ID from Electron...');
      this.updateStatus('ready', 'Loading proceeding information...');
    }
  }

  async loadProceedingData() {
    console.log(`=== Loading proceeding data for ID: ${this.proceedingId} ===`);
    
    if (!this.proceedingId) {
      console.error('No proceeding ID available for loading data');
      this.showError('No proceeding ID provided');
      return;
    }
    
    try {
      this.showLoading(true);
      
      const url = `http://localhost:5001/api/proceeding/${this.proceedingId}`;
      console.log('Fetching proceeding data from:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Proceeding data received:', data);
      this.proceedingData = data;
      
      console.log('Populating case information...');
      this.populateCaseInformation();
      
      console.log('Loading existing transcript...');
      await this.loadExistingTranscript();
      
      console.log('Proceeding data loaded successfully');
      
    } catch (error) {
      console.error('Error loading proceeding data:', error);
      this.showError(`Failed to load proceeding data: ${error.message}`);
    } finally {
      this.showLoading(false);
    }
  }

  populateCaseInformation() {
    if (!this.proceedingData) {
      console.error('No proceeding data available for population');
      return;
    }
    
    const data = this.proceedingData;
    console.log('Populating UI with proceeding data:', data);
    
    // Populate case information
    this.caseNumberTop.textContent = `Case No: ${data.case_number || 'N/A'}`;
    
    // Create case title from plaintiff vs defendant
    let caseTitle = 'Unknown Case';
    if (data.plaintiff && data.defendant) {
      caseTitle = `${data.plaintiff.appelation || ''} ${data.plaintiff.name || ''} vs ${data.defendant.appelation || ''} ${data.defendant.name || ''}`.trim();
    }
    this.caseTitleLine.textContent = caseTitle;
    
    this.caseTypeLine.textContent = data.case_type || 'N/A';
    this.chargesLine.textContent = data.charges || 'N/A';
    
    // Format date and time from schedule_datetime
    if (data.schedule_datetime) {
      try {
        const dateTime = new Date(data.schedule_datetime);
        this.sessionDateLine.textContent = dateTime.toLocaleString();
      } catch (error) {
        console.error('Error parsing schedule_datetime:', error);
        this.sessionDateLine.textContent = data.schedule_datetime;
      }
    } else {
      this.sessionDateLine.textContent = 'Not scheduled';
    }
    
    // Populate court composition
    this.judgeLine.textContent = `PRESIDING JUDGE: ${data.judge_name || 'Not assigned'}`;
    this.clerkLine.textContent = `COURT CLERK: ${data.clerk_name || 'Not assigned'}`;
    
    console.log('Case information populated successfully');
  }

  async loadExistingTranscript() {
    try {
      const response = await fetch(`http://localhost:5001/api/transcript/${this.proceedingId}`);
      
      if (response.ok) {
        const data = await response.json();
        this.transcriptContent = data.content || '';
        this.transcriptTextarea.value = this.transcriptContent;
        
        if (data.last_modified) {
          const lastModified = new Date(data.last_modified);
          this.lastSavedSpan.textContent = `Last saved: ${lastModified.toLocaleString()}`;
        }
      }
    } catch (error) {
      console.error('Error loading existing transcript:', error);
    }
  }

  async startTranscription() {
    try {
      // Start transcription session
      const response = await fetch('http://localhost:5001/api/transcription/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proceeding_id: this.proceedingId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start transcription session');
      }
      
      const data = await response.json();
      this.sessionId = data.session_id;
      
      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      this.isRecording = true;
      this.isPaused = false;
      
      // Update UI
      this.startBtn.disabled = true;
      this.pauseBtn.disabled = false;
      this.restartBtn.disabled = false;
      this.transcriptTextarea.readOnly = true;
      
      this.updateStatus('recording', 'Recording in progress...');
      
      // Start audio recording
      this.startAudioRecording();
      
      // Start listening for updates
      this.startEventStream();
      
      console.log('Transcription started for proceeding:', this.proceedingId);
      
    } catch (error) {
      console.error('Error starting transcription:', error);
      alert('Could not start transcription. Please check permissions and try again.');
      this.resetTranscriptionState();
    }
  }

  startAudioRecording() {
    if (!this.audioStream) return;
    
    try {
      // Try different audio formats for better compatibility
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Let browser choose
          }
        }
      }
      
      console.log('Using audio format:', mimeType);
      
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: mimeType
      });
      
      this.audioChunks = [];
      
      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          console.log('Audio chunk received, size:', event.data.size);
          this.audioChunks.push(event.data);
        }
      });
      
      this.mediaRecorder.addEventListener('stop', () => {
        if (this.audioChunks.length > 0) {
          console.log('MediaRecorder stopped, uploading chunk...');
          this.uploadAudioChunk();
        }
      });
      
      // Record in 5-second chunks for better transcription quality
      this.mediaRecorder.start();
      
      // Set up interval to stop and restart recording for chunking
      this.recordingInterval = setInterval(() => {
        if (this.isRecording && !this.isPaused && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
          setTimeout(() => {
            if (this.isRecording && !this.isPaused) {
              this.audioChunks = [];
              this.mediaRecorder.start();
            }
          }, 100);
        }
      }, 5000); // 5 seconds for better quality
      
    } catch (error) {
      console.error('Error starting audio recording:', error);
      alert('Error starting audio recording. Please try again.');
    }
  }

  async uploadAudioChunk() {
    if (!this.sessionId || this.audioChunks.length === 0) return;
    
    try {
      console.log('Uploading audio chunk with', this.audioChunks.length, 'pieces');
      
      // Determine the correct MIME type based on what was recorded
      let mimeType = 'audio/webm';
      if (this.mediaRecorder && this.mediaRecorder.mimeType) {
        mimeType = this.mediaRecorder.mimeType;
      }
      
      const audioBlob = new Blob(this.audioChunks, { type: mimeType });
      console.log('Audio blob size:', audioBlob.size, 'bytes, type:', mimeType);
      
      const formData = new FormData();
      formData.append('session_id', this.sessionId);
      formData.append('audio', audioBlob, 'audio_chunk.' + (mimeType.includes('mp4') ? 'mp4' : 'webm'));
      
      console.log('Sending audio to server...');
      const response = await fetch('http://localhost:5001/api/transcription/audio', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Audio chunk processed successfully:', data.text);
        if (data.text && data.text.trim()) {
          console.log('Transcribed text:', data.text);
        }
      } else {
        console.error('Server error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('Error uploading audio chunk:', error);
    }
  }

  startEventStream() {
    if (!this.sessionId) return;
    
    this.eventSource = new EventSource(`http://localhost:5001/api/transcription/stream/${this.sessionId}`);
    
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleTranscriptionUpdate(data);
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };
    
    this.eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
    };
  }

  handleTranscriptionUpdate(data) {
    switch (data.type) {
      case 'transcription':
        // Update transcript content
        this.transcriptContent = data.full_transcript;
        this.transcriptTextarea.value = this.transcriptContent;
        this.transcriptTextarea.scrollTop = this.transcriptTextarea.scrollHeight;
        this.updateLastSavedTime();
        break;
      
      case 'clear':
        this.transcriptContent = '';
        this.transcriptTextarea.value = '';
        break;
      
      case 'connected':
        console.log('Connected to transcription stream');
        break;
      
      case 'heartbeat':
        // Keep connection alive
        break;
    }
  }

  stopAudioRecording() {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
  }

  stopEventStream() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  pauseTranscription() {
    this.isPaused = true;
    
    // Stop audio recording temporarily
    this.stopAudioRecording();
    
    // Update UI
    this.startBtn.disabled = false;
    this.startBtn.textContent = 'Resume';
    this.pauseBtn.disabled = true;
    
    this.updateStatus('paused', 'Transcription paused');
    
    console.log('Transcription paused');
  }

  async restartTranscription() {
    const confirmed = confirm('Are you sure you want to restart the transcription? This will clear all current content and delete it from storage.');
    
    if (confirmed) {
      // Stop current transcription
      this.stopAudioRecording();
      this.stopEventStream();
      
      // Clear transcript from backend
      if (this.sessionId) {
        try {
          await fetch('http://localhost:5001/api/transcription/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: this.sessionId })
          });
          
          await fetch('http://localhost:5001/api/transcription/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: this.sessionId })
          });
        } catch (error) {
          console.error('Error clearing transcription:', error);
        }
      }
      
      // Reset local state
      this.isRecording = false;
      this.isPaused = false;
      this.transcriptContent = '';
      this.transcriptTextarea.value = '';
      this.sessionId = null;
      
      // Reset UI
      this.resetTranscriptionState();
      
      console.log('Transcription restarted and cleared from storage');
    }
  }

  resetTranscriptionState() {
    this.isRecording = false;
    this.isPaused = false;
    
    // Reset UI
    this.startBtn.disabled = false;
    this.startBtn.textContent = 'Start';
    this.pauseBtn.disabled = true;
    this.restartBtn.disabled = true;
    this.transcriptTextarea.readOnly = true;
    
    this.updateStatus('ready', 'Ready to start');
  }

  updateStatus(status, text) {
    this.statusElements.statusDot.className = `status-dot ${status}`;
    this.statusElements.statusText.textContent = text;
  }

  updateLastSavedTime() {
    const now = new Date();
    this.lastSavedSpan.textContent = `Last updated: ${now.toLocaleTimeString()}`;
  }

  showLoading(show) {
    const elements = [this.caseNumberTop, this.caseTitleLine, this.caseTypeLine, this.chargesLine, this.judgeLine, this.clerkLine, this.sessionDateLine];
    elements.forEach(el => {
      if (show) {
        el.classList.add('loading');
        el.textContent = 'Loading...';
      } else {
        el.classList.remove('loading');
      }
    });
  }

  showError(message) {
    this.caseTitleLine.textContent = message;
    this.caseTitleLine.style.color = '#dc3545';
  }
}

// Initialize the transcript manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.transcriptManager = new SimpleTranscriptManager();
});

// Handle Electron IPC if available
// Check for both contextBridge API and direct require access
if (typeof window !== 'undefined') {
  // Try contextBridge API first (secure mode)
  if (window.electronAPI) {
    console.log('Using contextBridge API for Electron IPC');
    // We can't listen to events with contextBridge, so we'll use a different approach
  }
  // Try direct require access (legacy mode)
  else if (window.require) {
    console.log('Using direct require for Electron IPC');
    try {
      const { ipcRenderer } = window.require('electron');
      
      // Listen for proceeding data from main process
      ipcRenderer.on('load-proceeding', (event, proceedingId) => {
        console.log('Received proceeding ID from Electron:', proceedingId);
        if (window.transcriptManager) {
          window.transcriptManager.proceedingId = proceedingId;
          window.transcriptManager.loadProceedingData();
        }
      });
    } catch (error) {
      console.error('Error setting up Electron IPC:', error);
    }
  } else {
    console.log('Electron IPC not available - running in browser mode');
  }
} 