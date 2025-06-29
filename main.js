const { app, BrowserWindow, ipcMain, session } = require('electron');
const { createTranscriptWindow, getCurrentTranscriptWindow } = require('./backend/transcriptWindow');
const { TranscriptionManager } = require('./backend/transcriptionManager');
const path = require('path');

let loginWindow;
let dashboardWindow;
let transcriptionManager;

// Initialize transcription manager
function initializeTranscriptionManager() {
    transcriptionManager = new TranscriptionManager();
    
    // Set up callbacks
    transcriptionManager.onTranscription((data) => {
        // Forward transcription to the transcript window
        const transcriptWindow = getCurrentTranscriptWindow();
        if (transcriptWindow && !transcriptWindow.isDestroyed()) {
            transcriptWindow.webContents.send('transcription-update', data);
        }
    });
    
    transcriptionManager.onError((error) => {
        console.error('Transcription error:', error);
        const transcriptWindow = getCurrentTranscriptWindow();
        if (transcriptWindow && !transcriptWindow.isDestroyed()) {
            transcriptWindow.webContents.send('transcription-error', { message: error });
        }
    });
    
    transcriptionManager.onStatus((status) => {
        const transcriptWindow = getCurrentTranscriptWindow();
        if (transcriptWindow && !transcriptWindow.isDestroyed()) {
            transcriptWindow.webContents.send('transcription-status', status);
        }
    });
    
    transcriptionManager.onReady((data) => {
        console.log('Transcription server ready:', data);
        const transcriptWindow = getCurrentTranscriptWindow();
        if (transcriptWindow && !transcriptWindow.isDestroyed()) {
            transcriptWindow.webContents.send('transcription-ready', data);
        }
    });
    
    // Start the transcription server
    transcriptionManager.startServer().then((success) => {
        if (success) {
            console.log('Transcription server started successfully');
        } else {
            console.error('Failed to start transcription server');
        }
    });
}

// Set up permissions for camera access
app.whenReady().then(() => {
  // Handle permission requests for camera and microphone
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('Permission request:', permission);
    
    // Allow camera and microphone access for face recognition
    if (permission === 'camera' || permission === 'microphone') {
      callback(true);
      return;
    }
    
    // Allow media devices (getUserMedia)
    if (permission === 'media') {
      callback(true);
      return;
    }
    
    callback(false);
  });

  // Handle device permission checks
  session.defaultSession.setDevicePermissionHandler((details) => {
    console.log('Device permission check:', details);
    
    // Allow camera and microphone devices
    if (details.deviceType === 'camera' || details.deviceType === 'microphone') {
      return true;
    }
    
    return false;
  });

  // Initialize transcription manager
  initializeTranscriptionManager();

  createLoginWindow();
});

// Create the login window first
function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'assets/icons/logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      // Enable media access for face recognition
      webSecurity: false, // Allow camera access in development
      allowRunningInsecureContent: true,
      experimentalFeatures: true
    }
  });

  loginWindow.loadFile('pages/login.html');
  loginWindow.on('closed', () => (loginWindow = null));
}

// Open the dashboard window after login
function createDashboardWindow() {
  dashboardWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets/icons/logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // ✅ REQUIRED
      contextIsolation: true, // ✅ REQUIRED for contextBridge
      nodeIntegration: false  // ✅ MUST be false for security
    },
  });

  dashboardWindow.loadFile('pages/index.html');
  dashboardWindow.on('closed', () => (dashboardWindow = null));
}

ipcMain.on('login-success', () => {
  if (loginWindow) loginWindow.close();
  createDashboardWindow();
});

ipcMain.handle('open-transcript', async (event, proceedingId) => {
  createTranscriptWindow(proceedingId);
});

ipcMain.on('open-transcription', (event, proceedingId) => {
  createTranscriptWindow(proceedingId);
});

// Transcription IPC handlers
ipcMain.handle('start-transcription', async (event, sessionId) => {
  if (transcriptionManager) {
    return transcriptionManager.startTranscription(sessionId);
  }
  return false;
});

ipcMain.handle('stop-transcription', async (event) => {
  if (transcriptionManager) {
    return transcriptionManager.stopTranscription();
  }
  return false;
});

ipcMain.handle('clear-transcript', async (event) => {
  if (transcriptionManager) {
    return transcriptionManager.clearTranscript();
  }
  return false;
});

ipcMain.handle('get-transcript-status', async (event) => {
  if (transcriptionManager) {
    transcriptionManager.getStatus();
    return transcriptionManager.isTranscriptionRunning();
  }
  return false;
});

ipcMain.handle('get-transcript-buffer', async (event) => {
  if (transcriptionManager) {
    return transcriptionManager.getTranscriptBuffer();
  }
  return '';
});

// Handle logout navigation
ipcMain.on('navigate-to-login', () => {
  // Close dashboard window if it exists
  if (dashboardWindow) {
    dashboardWindow.close();
    dashboardWindow = null;
  }
  
  // Close transcript window if it exists
  const transcriptWindow = getCurrentTranscriptWindow();
  if (transcriptWindow && !transcriptWindow.isDestroyed()) {
    transcriptWindow.close();
  }
  
  // Create new login window
  createLoginWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createLoginWindow();
  }
});

app.on('before-quit', () => {
  // Clean up transcription manager
  if (transcriptionManager) {
    transcriptionManager.stopServer();
  }
});

// Add command line switches for better camera support
app.commandLine.appendSwitch('enable-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');