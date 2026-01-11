const { contextBridge, ipcRenderer } = require('electron');

// Expose safe Electron APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Google Calendar method
  getCalendarEvents: (calendarId, timeMin, timeMax) =>
    ipcRenderer.invoke('get-calendar-events', calendarId, timeMin, timeMax),

  // Calendar data listener
  onCalendarData: (callback) => ipcRenderer.on('calendar-data', callback),

  // Open external URLs - must go through main process (sandboxed renderer can't use shell directly)
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),

  // Claude API - Secure method (API key stays in main process)
  // Can include context about connected sheets
  callClaudeAPI: (message, context) => ipcRenderer.invoke('call-claude-api', message, context),

  // Get environment variables securely
  getEnvVar: (key) => ipcRenderer.invoke('get-env-var', key),

  // File Storage APIs
  createCardFolder: (cardInfo) => ipcRenderer.invoke('create-card-folder', cardInfo),
  saveFile: (fileInfo) => ipcRenderer.invoke('save-file', fileInfo),
  saveLink: (linkInfo) => ipcRenderer.invoke('save-link', linkInfo),
  getFiles: (ownerInfo) => ipcRenderer.invoke('get-files', ownerInfo),
  deleteFile: (fileInfo) => ipcRenderer.invoke('delete-file', fileInfo),
  deleteOwnerFolder: (ownerInfo) => ipcRenderer.invoke('delete-owner-folder', ownerInfo),
  getAllFiles: () => ipcRenderer.invoke('get-all-files'),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  moveLeadToClient: (info) => ipcRenderer.invoke('move-lead-to-client', info),

  // Whisper.cpp Transcription APIs (offline, no external dependencies)
  transcribeAudioFile: (filePath) => ipcRenderer.invoke('transcribe-audio-file', filePath),
  getWhisperStatus: () => ipcRenderer.invoke('get-whisper-status'),

  // Storage Settings APIs
  selectStorageFolder: () => ipcRenderer.invoke('select-storage-folder'),
  getStorageSettings: () => ipcRenderer.invoke('get-storage-settings'),
  setStorageFolder: (folderPath) => ipcRenderer.invoke('set-storage-folder', folderPath),
  openStorageFolder: () => ipcRenderer.invoke('open-storage-folder')
});