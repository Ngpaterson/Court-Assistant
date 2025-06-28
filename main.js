const { app, BrowserWindow, ipcMain, session } = require('electron');
const { createTranscriptWindow } = require('./backend/transcriptWindow');
const path = require('path');

let loginWindow;
let dashboardWindow;
let transcriptWindow;

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

// // ✅ Open the transcription window  
// function createTranscriptWindow(proceedingId) {
//   transcriptWindow = new BrowserWindow({
//     width: 1300,
//     height: 900,
//     icon: path.join(__dirname, 'assets/icons/logo.ico'),
//     webPreferences: {
//       preload: path.join(__dirname, 'preload.js'),
//       nodeIntegration: true,
//       contextIsolation: false,
//       additionalArguments: [`--proceedingId=${proceedingId}`],
//     },
//   });

//   transcriptWindow.loadFile('pages/transcript.html');
//   transcriptWindow.on('closed', () => (transcriptWindow = null));
// }

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

// Handle logout navigation
ipcMain.on('navigate-to-login', () => {
  // Close dashboard window if it exists
  if (dashboardWindow) {
    dashboardWindow.close();
    dashboardWindow = null;
  }
  
  // Close transcript window if it exists
  if (transcriptWindow) {
    transcriptWindow.close();
    transcriptWindow = null;
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

// Add command line switches for better camera support
app.commandLine.appendSwitch('enable-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');