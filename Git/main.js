const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// OAuth credentials file path
const OAUTH_CREDENTIALS_PATH = path.join(__dirname, 'oauth-credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

let oAuth2Client = null;
let calendarData = null;
let serverProcess = null;

// Start the Express server automatically
function startServer() {
  console.log('Starting Express server...');
  serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
    stdio: 'inherit'
  });

  serverProcess.on('error', (error) => {
    console.error('Failed to start server:', error);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

// Initialize OAuth client
function initializeOAuthClient() {
  try {
    if (!fs.existsSync(OAUTH_CREDENTIALS_PATH)) {
      console.error('OAuth credentials file not found');
      return null;
    }

    const credentials = JSON.parse(fs.readFileSync(OAUTH_CREDENTIALS_PATH));
    const { client_id, client_secret, redirect_uris } = credentials.web;

    oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // Load token if it exists
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
      oAuth2Client.setCredentials(token);
      console.log('✓ Loaded existing OAuth token');
      return oAuth2Client;
    }

    console.log('⚠ No OAuth token found. User needs to authenticate.');
    return oAuth2Client;
  } catch (error) {
    console.error('Error initializing OAuth client:', error);
    return null;
  }
}

// Get calendar events
async function getCalendarEvents(calendarId, timeMin, timeMax) {
  try {
    if (!oAuth2Client || !oAuth2Client.credentials || !oAuth2Client.credentials.access_token) {
      throw new Error('Not authenticated. Please authenticate first by visiting http://localhost:3001/auth');
    }

    console.log(`Fetching events for calendar: ${calendarId}`);
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: timeMin || new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      timeMax: timeMax || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500
    });

    // Get calendar info
    const calendarInfo = await calendar.calendars.get({ calendarId });

    console.log(`Successfully fetched ${response.data.items.length} events`);

    return {
      events: response.data.items || [],
      calendarInfo: {
        summary: calendarInfo.data.summary,
        description: calendarInfo.data.description
      }
    };
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
}

function createWindow() {
  // Initialize OAuth client
  initializeOAuthClient();

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
  // win.webContents.openDevTools(); // Uncomment for debugging

  // Load calendar data on startup if authenticated
  if (oAuth2Client && oAuth2Client.credentials && oAuth2Client.credentials.access_token) {
    loadCalendarData();
  }
}

async function loadCalendarData() {
  calendarData = await getCalendarEvents();
  // Send data to renderer when ready
  if (calendarData) {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('calendar-data', calendarData);
    });
  }
}

// IPC handlers for Google Calendar
ipcMain.handle('get-calendar-events', async (event, calendarId, timeMin, timeMax) => {
  console.log('IPC: get-calendar-events called for', calendarId);
  try {
    const data = await getCalendarEvents(calendarId, timeMin, timeMax);
    return { success: true, data };
  } catch (error) {
    console.error('IPC Error:', error);
    return { success: false, error: error.message };
  }
});

// IPC handlers
ipcMain.on('get-calendar-events', (event) => {
  getCalendarEvents().then(events => {
    event.reply('calendar-events', events);
  }).catch(error => {
    console.error('Error fetching calendar events:', error);
    event.reply('calendar-events', []);
  });
});

ipcMain.on('refresh-calendar', () => {
  loadCalendarData();
});

app.whenReady().then(() => {
  console.log('App is ready');
  startServer(); // Start server automatically

  // Give server 2 seconds to start before opening window
  setTimeout(() => {
    createWindow();
  }, 2000);
});

app.on('window-all-closed', () => {
  // Kill server process when app closes
  if (serverProcess) {
    serverProcess.kill();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Make sure server is killed on quit
  if (serverProcess) {
    serverProcess.kill();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});