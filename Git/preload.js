const { contextBridge, ipcRenderer } = require('electron');

// Keep any existing electronAPI methods you have, just add the Google one
contextBridge.exposeInMainWorld('electronAPI', {
  // Add this Google Calendar method
  getCalendarEvents: (calendarId, timeMin, timeMax) => 
    ipcRenderer.invoke('get-calendar-events', calendarId, timeMin, timeMax),
    
  // Keep your existing methods if any
  onCalendarData: (callback) => ipcRenderer.on('calendar-data', callback)
});