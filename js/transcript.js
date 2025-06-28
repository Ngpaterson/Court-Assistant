// Transcript management system
class TranscriptManager {
  constructor() {
    this.proceedingId = null;
    this.proceedingData = null;
    this.transcriptContent = '';
    this.isRecording = false;
    this.isPaused = false;
    this.saveInterval = null;
    this.lastSaveTime = null;
    
    this.initializeElements();
    this.setupEventListeners();
    this.initializeFromElectron();
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
    this.startBtn.addEventListener('click', () => this.startTranscription());
    this.pauseBtn.addEventListener('click', () => this.pauseTranscription());
    this.restartBtn.addEventListener('click', () => this.restartTranscription());
    
    // Auto-save on content change (simulation for now)
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
      // Fallback for development - extract from URL or use test data
      const urlParams = new URLSearchParams(window.location.search);
      this.proceedingId = urlParams.get('proceedingId') || 'test-proceeding-id';
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
    this.isRecording = true;
    this.isPaused = false;
    
    // Update UI
    this.startBtn.disabled = true;
    this.pauseBtn.disabled = false;
    this.restartBtn.disabled = false;
    this.transcriptTextarea.readOnly = false;
    
    this.updateStatus('recording', 'Recording in progress...');
    
    // Start auto-save interval
    this.startAutoSave();
    
    // Focus on textarea for input
    this.transcriptTextarea.focus();
    
    // Simulate transcription (for now, until Whisper integration)
    this.simulateTranscription();
    
    console.log('Transcription started for proceeding:', this.proceedingId);
  }

  pauseTranscription() {
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

  simulateTranscription() {
    if (!this.isRecording || this.isPaused) return;
    
    // Simulate speech-to-text input (remove this when Whisper is integrated)
    const sampleTexts = [
      'Your Honor, ',
      'the defendant pleads not guilty to the charges. ',
      'We request that the court consider the evidence presented. ',
      'The witness testified under oath that... ',
      'According to Article 123 of the Penal Code... ',
      'The prosecution argues that... ',
      'Defense objects to this line of questioning. '
    ];
    
    const addText = () => {
      if (this.isRecording && !this.isPaused) {
        const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
        this.transcriptContent += randomText;
        this.transcriptTextarea.value = this.transcriptContent;
        this.transcriptTextarea.scrollTop = this.transcriptTextarea.scrollHeight;
        
        // Schedule next addition
        setTimeout(addText, Math.random() * 3000 + 2000); // 2-5 seconds
      }
    };
    
    // Start simulation after a short delay
    setTimeout(addText, 1000);
  }

  updateStatus(status, text) {
    this.statusDot.className = `status-dot ${status}`;
    this.statusText.textContent = text;
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
    if (this.lastSaveTime) {
      this.lastSavedSpan.textContent = `Last saved: ${this.lastSaveTime.toLocaleTimeString()}`;
    }
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