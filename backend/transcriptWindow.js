// === transcriptWindow.js ===

const { BrowserWindow } = require("electron");
const path = require("path");

let currentTranscriptWindow = null;

function createTranscriptWindow(proceedingId) {
  console.log(`Creating transcript window for proceeding: ${proceedingId}`);
  
  // Close existing window if any
  if (currentTranscriptWindow && !currentTranscriptWindow.isDestroyed()) {
    currentTranscriptWindow.close();
  }
  
  currentTranscriptWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: path.join(__dirname, '..', 'assets', 'icons', 'logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"), // Fixed path
      nodeIntegration: true,
      contextIsolation: false,
      // Enable media access for transcription
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true
    },
    title: "Transcription in Progress",
  });

  currentTranscriptWindow.loadFile(path.join(__dirname, "..", "pages", "transcript.html"));

  // Send the proceeding ID once the window is ready
  currentTranscriptWindow.webContents.on("did-finish-load", () => {
    console.log(`Sending proceeding ID to transcript window: ${proceedingId}`);
    currentTranscriptWindow.webContents.send("load-proceeding", proceedingId);
  });
  
  // Add error handling
  currentTranscriptWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error(`Failed to load transcript window: ${errorCode} - ${errorDescription}`);
  });
  
  // Handle window close
  currentTranscriptWindow.on("closed", () => {
    currentTranscriptWindow = null;
  });
  
  return currentTranscriptWindow;
}

// Get current transcript window
function getCurrentTranscriptWindow() {
  return currentTranscriptWindow;
}

module.exports = { createTranscriptWindow, getCurrentTranscriptWindow };
