const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openTranscript: (proceedingId) => ipcRenderer.invoke('open-transcript', proceedingId)
});