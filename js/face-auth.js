const { ipcRenderer } = require("electron");

class FaceAuth {
  constructor() {
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.statusDot = document.getElementById('statusDot');
    this.statusText = document.getElementById('statusText');
    this.startBtn = document.getElementById('startVerification');
    this.retryBtn = document.getElementById('retryBtn');
    this.backBtn = document.getElementById('backToLogin');
    this.successMessage = document.getElementById('successMessage');
    this.errorMessage = document.getElementById('errorMessage');
    this.errorText = document.getElementById('errorText');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    
    this.stream = null;
    this.isRecognizing = false;
    this.userData = null;
    
    this.init();
  }

  async init() {
    // Get user data from URL parameters or localStorage
    this.getUserData();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize camera
    await this.initCamera();
  }

  getUserData() {
    // Get user data passed from login page
    const urlParams = new URLSearchParams(window.location.search);
    this.userData = {
      matricule: urlParams.get('matricule') || localStorage.getItem('temp_matricule'),
      name: urlParams.get('name') || localStorage.getItem('temp_name'),
      role: urlParams.get('role') || localStorage.getItem('temp_role')
    };
    
    if (!this.userData.matricule) {
      this.showError('User data not found. Please login again.');
      return;
    }
  }

  setupEventListeners() {
    this.startBtn.addEventListener('click', () => this.startFaceRecognition());
    this.retryBtn.addEventListener('click', () => this.retryRecognition());
    this.backBtn.addEventListener('click', () => this.goBackToLogin());
  }

  async initCamera() {
    try {
      this.updateStatus('Requesting camera access...', 'waiting');
      
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      
      this.video.srcObject = this.stream;
      
      this.video.onloadedmetadata = () => {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.updateStatus('Camera ready. Click to start verification', 'ready');
        this.startBtn.disabled = false;
      };
      
    } catch (error) {
      console.error('Camera access error:', error);
      this.updateStatus('Camera access denied', 'error');
      this.showError('Unable to access camera. Please check permissions and try again.');
    }
  }

  updateStatus(text, type = 'waiting') {
    this.statusText.textContent = text;
    this.statusDot.className = 'status-dot';
    
    if (type === 'ready') {
      this.statusDot.classList.add('ready');
    } else if (type === 'error') {
      this.statusDot.classList.add('error');
    }
  }

  showError(message) {
    this.errorText.textContent = message;
    this.errorMessage.style.display = 'flex';
    this.successMessage.style.display = 'none';
    this.retryBtn.style.display = 'inline-block';
  }

  showSuccess(message) {
    this.successMessage.querySelector('.text').textContent = message;
    this.successMessage.style.display = 'flex';
    this.errorMessage.style.display = 'none';
  }

  hideMessages() {
    this.successMessage.style.display = 'none';
    this.errorMessage.style.display = 'none';
    this.retryBtn.style.display = 'none';
  }

  showLoading(show = true) {
    this.loadingOverlay.style.display = show ? 'flex' : 'none';
  }

  async startFaceRecognition() {
    if (this.isRecognizing) return;
    
    this.isRecognizing = true;
    this.hideMessages();
    this.showLoading(true);
    this.updateStatus('Processing facial recognition...', 'waiting');
    this.startBtn.disabled = true;
    
    try {
      // Capture frame from video
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      const imageData = this.canvas.toDataURL('image/jpeg', 0.8);
      
      // Send to server for recognition
      const response = await fetch('http://localhost:5001/api/face-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          matricule: this.userData.matricule,
          image_data: imageData
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.updateStatus('Face recognized successfully!', 'ready');
        this.showSuccess('Facial recognition successful! Logging you in...');
        
        // Complete login process
        setTimeout(() => {
          this.completeLogin();
        }, 2000);
        
      } else {
        this.updateStatus('Face not recognized', 'error');
        this.showError(result.message || 'Facial recognition failed. Please try again.');
      }
      
    } catch (error) {
      console.error('Face recognition error:', error);
      this.updateStatus('Recognition failed', 'error');
      this.showError('Connection error. Please check your network and try again.');
    } finally {
      this.showLoading(false);
      this.isRecognizing = false;
      this.startBtn.disabled = false;
    }
  }

  retryRecognition() {
    this.hideMessages();
    this.updateStatus('Camera ready. Click to start verification', 'ready');
    this.startBtn.disabled = false;
  }

  completeLogin() {
    // Store user data in localStorage
    localStorage.setItem('user_name', this.userData.name);
    localStorage.setItem('matricule', this.userData.matricule);
    localStorage.setItem('role', this.userData.role);
    
    // Clear temporary data
    localStorage.removeItem('temp_matricule');
    localStorage.removeItem('temp_name');
    localStorage.removeItem('temp_role');
    
    // Notify Electron main process
    ipcRenderer.send('login-success', {
      role: this.userData.role,
      name: this.userData.name,
      matricule: this.userData.matricule
    });
  }

  goBackToLogin() {
    // Clear temporary data
    localStorage.removeItem('temp_matricule');
    localStorage.removeItem('temp_name');
    localStorage.removeItem('temp_role');
    
    // Stop camera stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    // Navigate back to login
    window.location.href = 'login.html';
  }

  // Clean up resources when page unloads
  cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  }
}

// Initialize face authentication when page loads
document.addEventListener('DOMContentLoaded', () => {
  const faceAuth = new FaceAuth();
  
  // Clean up when page unloads
  window.addEventListener('beforeunload', () => {
    faceAuth.cleanup();
  });
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is hidden, pause operations if needed
  } else {
    // Page is visible again
  }
}); 