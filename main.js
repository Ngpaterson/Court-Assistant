const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'assets/icons/logo.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('pages/login.html');
}

app.whenReady().then(createWindow);
