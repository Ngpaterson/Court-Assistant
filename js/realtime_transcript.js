/**
 * Real-time Transcription Frontend
 * Uses Electron IPC for communication with the Python transcription server
 */

class RealtimeTranscriptManager {
    constructor() {
        this.proceedingId = null;
        this.proceedingData = null;
        this.transcriptContent = '';
        this.isRecording = false;
        this.isPaused = false;
        this.sessionId = null;
        
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
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startTranscription());
        this.pauseBtn.addEventListener('click', () => this.pauseTranscription());
        this.restartBtn.addEventListener('click', () => this.restartTranscription());
    }

    initializeFromElectron() {
        console.log('Initializing real-time transcript manager');
        
        const urlParams = new URLSearchParams(window.location.search);
        this.proceedingId = urlParams.get('proceeding_id');
        console.log('Proceeding ID from URL:', this.proceedingId);
        
        if (this.proceedingId) {
            console.log('Loading proceeding data from URL parameter');
            this.loadProceedingData();
        } else {
            console.log('No URL parameter, waiting for proceeding ID from Electron...');
            this.updateStatus('ready', 'Loading proceeding information...');
        }
        
        this.setupElectronIPC();
        console.log('Electron IPC setup completed');
    }

    setupElectronIPC() {
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                
                ipcRenderer.on('load-proceeding', (event, proceedingId) => {
                    console.log('Frontend received proceeding ID:', proceedingId);
                    if (!this.proceedingId) {
                        this.proceedingId = proceedingId;
                        this.loadProceedingData();
                    }
                });
                
                ipcRenderer.on('transcription-update', (event, data) => {
                    console.log('Frontend received transcription update:', data);
                    this.handleTranscriptionUpdate(data);
                });
                
                ipcRenderer.on('transcription-error', (event, data) => {
                    console.error('Frontend received transcription error:', data);
                    this.showError(data.message);
                });
                
                ipcRenderer.on('transcription-status', (event, status) => {
                    console.log('Frontend received transcription status:', status);
                    this.updateStatusFromServer(status);
                });
                
                ipcRenderer.on('transcription-ready', (event, data) => {
                    console.log('Frontend received transcription ready:', data);
                    this.updateStatus('ready', 'Transcription server ready');
                });
                
            } catch (error) {
                console.error('Error setting up Electron IPC:', error);
            }
        }
    }

    async loadProceedingData() {
        // Show loading state
        this.updateStatus('loading', 'Loading proceeding data...');
        this.caseTitleLine.textContent = 'Loading case information...';
        this.judgeLine.textContent = 'Loading judge information...';
        this.clerkLine.textContent = 'Loading clerk information...';
        
        try {
            const url = `http://localhost:5001/api/proceeding/${this.proceedingId}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.proceedingData = data;
            this.populateCaseInformation();
            await this.loadExistingTranscript();
            this.updateStatus('ready', 'Ready to start transcription');
            
        } catch (error) {
            console.error('Error loading proceeding data:', error);
            this.showError(`Failed to load proceeding data: ${error.message}`);
            this.updateStatus('error', 'Failed to load proceeding data');
        }
    }

    populateCaseInformation() {
        const data = this.proceedingData;
        
        this.caseNumberTop.textContent = `Case No: ${data.case_number || 'N/A'}`;
        
        let caseTitle = 'Unknown Case';
        if (data.plaintiff && data.defendant) {
            caseTitle = `${data.plaintiff.appelation || ''} ${data.plaintiff.name || ''} vs ${data.defendant.appelation || ''} ${data.defendant.name || ''}`.trim();
        }
        this.caseTitleLine.textContent = caseTitle;
        
        this.caseTypeLine.textContent = data.case_type || 'N/A';
        this.chargesLine.textContent = data.charges || 'N/A';
        
        if (data.schedule_datetime) {
            try {
                const dateTime = new Date(data.schedule_datetime);
                this.sessionDateLine.textContent = dateTime.toLocaleString();
            } catch (error) {
                this.sessionDateLine.textContent = data.schedule_datetime;
            }
        } else {
            this.sessionDateLine.textContent = 'Not scheduled';
        }
        
        this.judgeLine.textContent = `PRESIDING JUDGE: ${data.judge_name || 'Not assigned'}`;
        this.clerkLine.textContent = `COURT CLERK: ${data.clerk_name || 'Not assigned'}`;
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
            this.sessionId = `session_${this.proceedingId}_${Date.now()}`;
            
            // Show loading state
            this.updateStatus('loading', 'Starting transcription...');
            this.startBtn.disabled = true;
            this.pauseBtn.disabled = true;
            this.restartBtn.disabled = true;
            
            const success = await window.require('electron').ipcRenderer.invoke('start-transcription', this.sessionId);
            
            if (success) {
                this.isRecording = true;
                this.isPaused = false;
                
                this.startBtn.disabled = true;
                this.pauseBtn.disabled = false;
                this.restartBtn.disabled = false;
                this.transcriptTextarea.readOnly = true;
                
                this.updateStatus('recording', 'Recording in progress...');
            } else {
                throw new Error('Failed to start transcription');
            }
            
        } catch (error) {
            console.error('Error starting transcription:', error);
            alert('Could not start transcription. Please check permissions and try again.');
            this.updateStatus('error', 'Failed to start transcription');
            this.startBtn.disabled = false;
            this.pauseBtn.disabled = true;
            this.restartBtn.disabled = true;
        }
    }

    handleTranscriptionUpdate(data) {
        console.log('Handling transcription update:', data);
        if (data.type === 'transcription') {
            console.log('Updating transcript with text:', data.text);
            console.log('Full transcript:', data.full_transcript);
            this.transcriptContent = data.full_transcript;
            this.transcriptTextarea.value = this.transcriptContent;
            this.transcriptTextarea.scrollTop = this.transcriptTextarea.scrollHeight;
            this.updateLastSavedTime();
            console.log('Transcript updated in UI');
        } else if (data.type === 'clear') {
            console.log('Clearing transcript');
            this.transcriptContent = '';
            this.transcriptTextarea.value = '';
        } else {
            console.log('Unknown transcription update type:', data.type);
        }
    }

    updateStatusFromServer(status) {
        if (status.is_recording) {
            this.updateStatus('recording', 'Recording in progress...');
        } else if (status.model_loaded) {
            this.updateStatus('ready', 'Ready to start transcription');
        } else {
            this.updateStatus('loading', 'Loading transcription model...');
        }
    }

    async pauseTranscription() {
        this.isPaused = true;
        this.startBtn.disabled = false;
        this.startBtn.textContent = 'Resume';
        this.pauseBtn.disabled = true;
        this.updateStatus('paused', 'Transcription paused');
    }

    async restartTranscription() {
        const confirmed = confirm('Are you sure you want to restart the transcription? This will clear all current content.');
        
        if (confirmed) {
            await window.require('electron').ipcRenderer.invoke('stop-transcription');
            await window.require('electron').ipcRenderer.invoke('clear-transcript');
            
            this.isRecording = false;
            this.isPaused = false;
            this.transcriptContent = '';
            this.transcriptTextarea.value = '';
            this.sessionId = null;
            
            this.resetTranscriptionState();
        }
    }

    resetTranscriptionState() {
        this.isRecording = false;
        this.isPaused = false;
        
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

    showError(message) {
        this.caseTitleLine.textContent = message;
        this.caseTitleLine.style.color = '#dc3545';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.transcriptManager = new RealtimeTranscriptManager();
}); 