const { app, BrowserWindow, ipcMain } = require('electron');
const { createTranscriptWindow } = require('./backend/transcriptWindow');
const path = require('path');

let loginWindow;
let dashboardWindow;
let transcriptWindow;

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
//       nodeIntegration: true,
//       contextIsolation: false,
//       additionalArguments: [`--proceedingId=${proceedingId}`],
//     },
//   });

//   transcriptWindow.loadFile('pages/transcript.html');
//   transcriptWindow.on('closed', () => (transcriptWindow = null));
// }

app.whenReady().then(createLoginWindow);

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