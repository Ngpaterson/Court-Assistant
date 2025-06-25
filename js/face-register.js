class FaceRegister {
  constructor() {
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('canvas');
    this.previewCanvas = document.getElementById('previewCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.previewCtx = this.previewCanvas.getContext('2d');
    
    this.matriculeInput = document.getElementById('matricule');
    this.searchBtn = document.getElementById('searchUser');
    this.userInfo = document.getElementById('userInfo');
    this.cameraSection = document.getElementById('cameraSection');
    this.previewSection = document.getElementById('previewSection');
    
    this.captureBtn = document.getElementById('captureBtn');
    this.retakeBtn = document.getElementById('retakeBtn');
    this.registerBtn = document.getElementById('registerBtn');
    this.resetBtn = document.getElementById('resetBtn');
    this.backBtn = document.getElementById('backBtn');
    
    this.successMessage = document.getElementById('successMessage');
    this.errorMessage = document.getElementById('errorMessage');
    this.errorText = document.getElementById('errorText');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    
    this.stream = null;
    this.currentUser = null;
    this.capturedImageData = null;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.searchBtn.addEventListener('click', () => this.searchUser());
    this.matriculeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.searchUser();
    });
    
    this.captureBtn.addEventListener('click', () => this.captureImage());
    this.retakeBtn.addEventListener('click', () => this.retakeImage());
    this.registerBtn.addEventListener('click', () => this.registerFace());
    this.resetBtn.addEventListener('click', () => this.reset());
    this.backBtn.addEventListener('click', () => this.goBack());
  }

  async searchUser() {
    const matricule = this.matriculeInput.value.trim();
    
    if (!matricule) {
      this.showError('Please enter a matricule');
      return;
    }

    this.showLoading(true, 'Searching user...');
    this.hideMessages();

    try {
      // First, get user info from login endpoint
      const loginResponse = await fetch('http://localhost:5001/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          matricule: matricule, 
          password: 'dummy' // We just want to check if user exists
        })
      });

      const loginResult = await loginResponse.json();
      
      if (loginResult.success || loginResponse.status === 401) {
        // User exists (either login success or wrong password)
        // Now check face registration status
        const faceResponse = await fetch(`http://localhost:5001/api/check-face-registration/${matricule}`);
        const faceResult = await faceResponse.json();
        
        if (faceResult.success) {
          this.currentUser = {
            matricule: matricule,
            name: loginResult.user ? loginResult.user.name : 'Unknown User',
            role: loginResult.role || 'Unknown Role',
            hasFaceData: faceResult.has_face_data
          };
          
          this.displayUserInfo();
          if (!this.currentUser.hasFaceData) {
            await this.initCamera();
          }
        } else {
          this.showError(faceResult.message || 'Error checking user');
        }
      } else {
        this.showError('User not found');
      }
      
    } catch (error) {
      console.error('Search error:', error);
      this.showError('Connection error. Please check your network.');
    } finally {
      this.showLoading(false);
    }
  }

  displayUserInfo() {
    document.getElementById('userName').textContent = this.currentUser.name;
    document.getElementById('userMatricule').textContent = `Matricule: ${this.currentUser.matricule}`;
    document.getElementById('userRole').textContent = `Role: ${this.currentUser.role.charAt(0).toUpperCase() + this.currentUser.role.slice(1)}`;
    
    const faceStatus = document.getElementById('faceStatus');
    if (this.currentUser.hasFaceData) {
      faceStatus.textContent = '✓ Face data already registered';
      faceStatus.className = 'face-status registered';
    } else {
      faceStatus.textContent = '⚠ Face data not registered';
      faceStatus.className = 'face-status not-registered';
    }
    
    this.userInfo.style.display = 'block';
    
    if (!this.currentUser.hasFaceData) {
      this.cameraSection.style.display = 'block';
    }
  }

  async initCamera() {
    try {
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
      };
      
    } catch (error) {
      console.error('Camera access error:', error);
      this.showError('Unable to access camera. Please check permissions.');
    }
  }

  captureImage() {
    if (!this.video.videoWidth || !this.video.videoHeight) {
      this.showError('Camera not ready. Please wait.');
      return;
    }

    // Draw current video frame to canvas
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    
    // Get image data
    this.capturedImageData = this.canvas.toDataURL('image/jpeg', 0.8);
    
    // Show preview
    this.showPreview();
  }

  showPreview() {
    // Set preview canvas size
    this.previewCanvas.width = 300;
    this.previewCanvas.height = 300;
    
    // Create image element to draw on preview canvas
    const img = new Image();
    img.onload = () => {
      // Calculate aspect ratio and draw
      const aspectRatio = img.width / img.height;
      let drawWidth = 300;
      let drawHeight = 300;
      
      if (aspectRatio > 1) {
        drawHeight = 300 / aspectRatio;
      } else {
        drawWidth = 300 * aspectRatio;
      }
      
      const x = (300 - drawWidth) / 2;
      const y = (300 - drawHeight) / 2;
      
      this.previewCtx.clearRect(0, 0, 300, 300);
      this.previewCtx.drawImage(img, x, y, drawWidth, drawHeight);
    };
    img.src = this.capturedImageData;
    
    this.previewSection.style.display = 'block';
  }

  retakeImage() {
    this.previewSection.style.display = 'none';
    this.capturedImageData = null;
  }

  async registerFace() {
    if (!this.capturedImageData) {
      this.showError('Please capture an image first');
      return;
    }

    this.showLoading(true, 'Registering face...');
    this.hideMessages();

    try {
      const response = await fetch('http://localhost:5001/api/register-face', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          matricule: this.currentUser.matricule,
          image_data: this.capturedImageData
        })
      });

      const result = await response.json();

      if (result.success) {
        this.showSuccess('Face registered successfully!');
        this.currentUser.hasFaceData = true;
        this.displayUserInfo();
        this.cameraSection.style.display = 'none';
        this.stopCamera();
      } else {
        this.showError(result.message || 'Registration failed');
      }

    } catch (error) {
      console.error('Registration error:', error);
      this.showError('Connection error. Please try again.');
    } finally {
      this.showLoading(false);
    }
  }

  reset() {
    this.currentUser = null;
    this.capturedImageData = null;
    this.matriculeInput.value = '';
    this.userInfo.style.display = 'none';
    this.cameraSection.style.display = 'none';
    this.previewSection.style.display = 'none';
    this.hideMessages();
    this.stopCamera();
  }

  goBack() {
    this.stopCamera();
    window.location.href = 'login.html';
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  showError(message) {
    this.errorText.textContent = message;
    this.errorMessage.style.display = 'flex';
    this.successMessage.style.display = 'none';
  }

  showSuccess(message) {
    this.successMessage.querySelector('.text').textContent = message;
    this.successMessage.style.display = 'flex';
    this.errorMessage.style.display = 'none';
  }

  hideMessages() {
    this.successMessage.style.display = 'none';
    this.errorMessage.style.display = 'none';
  }

  showLoading(show = true, text = 'Processing...') {
    document.getElementById('loadingText').textContent = text;
    this.loadingOverlay.style.display = show ? 'flex' : 'none';
  }

  cleanup() {
    this.stopCamera();
  }
}

// Initialize face registration when page loads
document.addEventListener('DOMContentLoaded', () => {
  const faceRegister = new FaceRegister();
  
  // Clean up when page unloads
  window.addEventListener('beforeunload', () => {
    faceRegister.cleanup();
  });
}); 