// === transcriptWindow.js ===

const { BrowserWindow } = require("electron");
const path = require("path");

function createTranscriptWindow(proceedingId) {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: path.join(__dirname, 'assets/icons/logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: "Transcription in Progress",
  });

  win.loadFile(path.join(__dirname, "..", "pages", "transcript.html"));

  // Send the proceeding ID once the window is ready
  win.webContents.on("did-finish-load", () => {
    win.webContents.send("load-proceeding", proceedingId);
  });
}

module.exports = { createTranscriptWindow };
