// === transcriptWindow.js ===

const { BrowserWindow } = require("electron");
const path = require("path");

function createTranscriptWindow(proceedingId) {
  console.log(`Creating transcript window for proceeding: ${proceedingId}`);
  
  const win = new BrowserWindow({
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

  win.loadFile(path.join(__dirname, "..", "pages", "transcript.html"));

  // Send the proceeding ID once the window is ready
  win.webContents.on("did-finish-load", () => {
    console.log(`Sending proceeding ID to transcript window: ${proceedingId}`);
    win.webContents.send("load-proceeding", proceedingId);
  });
  
  // Add error handling
  win.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error(`Failed to load transcript window: ${errorCode} - ${errorDescription}`);
  });
}

module.exports = { createTranscriptWindow };
