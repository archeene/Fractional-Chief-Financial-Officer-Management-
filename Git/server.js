const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Add this BEFORE your routes
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000', 'file://', '*'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// OAuth credentials file path
const OAUTH_CREDENTIALS_PATH = path.join(__dirname, 'oauth-credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

// Check if OAuth credentials file exists
if (!fs.existsSync(OAUTH_CREDENTIALS_PATH)) {
  console.error('ERROR: OAuth credentials file not found at:', OAUTH_CREDENTIALS_PATH);
  console.error('Please ensure oauth-credentials.json exists in the project root');
  process.exit(1);
}

// Load OAuth credentials
const credentials = JSON.parse(fs.readFileSync(OAUTH_CREDENTIALS_PATH));
const { client_id, client_secret, redirect_uris } = credentials.web;

// Create OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

// Load token if it exists
if (fs.existsSync(TOKEN_PATH)) {
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  oAuth2Client.setCredentials(token);
  console.log('✓ Loaded existing OAuth token');
}

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// OAuth authorization endpoint
app.get('/auth', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.redirect(authUrl);
});

// OAuth callback endpoint
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Save token to file
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log('✓ OAuth token saved successfully');

    res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1 style="color: green;">✓ Authentication Successful!</h1>
          <p>You can now close this window and use the calendar application.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error getting token:', error);
    res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1 style="color: red;">✗ Authentication Failed</h1>
          <p>Error: ${error.message}</p>
        </body>
      </html>
    `);
  }
});

// Root endpoint - shows server info and available routes
app.get('/', (req, res) => {
  const isAuthenticated = fs.existsSync(TOKEN_PATH);
  res.json({
    message: 'Multi Calendar Proxy Server',
    status: 'running',
    authenticated: isAuthenticated,
    endpoints: {
      auth: '/auth - Start OAuth authentication',
      health: '/api/health',
      calendarEvents: '/api/calendar/:calendarId/events',
      example: '/api/calendar/primary/events?timeMin=2024-01-01T00:00:00Z&timeMax=2024-12-31T23:59:59Z'
    },
    instructions: isAuthenticated
      ? 'You are authenticated and ready to use the calendar API'
      : 'Please visit /auth to authenticate with Google Calendar'
  });
});

// Handle Chrome DevTools requests - return 204 No Content
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});

// Proxy endpoint for calendar events
app.get('/api/calendar/:calendarId/events', async (req, res) => {
  try {
    // Check if authenticated
    if (!oAuth2Client.credentials || !oAuth2Client.credentials.access_token) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'Please visit /auth to authenticate with Google Calendar first'
      });
    }

    const { calendarId } = req.params;
    const { timeMin, timeMax } = req.query;

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

    res.json({
      events: response.data.items,
      calendarInfo: {
        summary: calendarInfo.data.summary,
        description: calendarInfo.data.description
      }
    });
  } catch (error) {
    console.error('Calendar API error:', error);
    res.status(500).json({
      error: error.message,
      details: error.toString(),
      hint: 'Make sure you have authenticated with /auth endpoint'
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    authenticated: fs.existsSync(TOKEN_PATH),
    oauthCredentialsExists: fs.existsSync(OAUTH_CREDENTIALS_PATH)
  });
});

// 404 handler for undefined routes (except Chrome DevTools)
app.use('*', (req, res, next) => {
  // Skip Chrome DevTools requests
  if (req.path.includes('.well-known/appspecific/com.chrome.devtools')) {
    return res.status(204).end();
  }
  
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: {
      root: '/',
      health: '/api/health',
      calendarEvents: '/api/calendar/:calendarId/events'
    }
  });
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Logging middleware
app.use((req, res, next) => {
  // Skip logging Chrome DevTools requests
  if (!req.path.includes('.well-known/appspecific/com.chrome.devtools')) {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  }
  next();
});

app.listen(PORT, () => {
  const isAuthenticated = fs.existsSync(TOKEN_PATH);
  console.log(`✓ Proxy server running on http://localhost:${PORT}`);
  console.log(`✓ OAuth credentials loaded from: ${OAUTH_CREDENTIALS_PATH}`);
  console.log(`✓ Authentication status: ${isAuthenticated ? 'Authenticated' : 'Not authenticated - visit /auth'}`);
  console.log(`✓ Test health endpoint: http://localhost:${PORT}/api/health`);
  console.log(`✓ Authenticate: http://localhost:${PORT}/auth`);
  console.log(`✓ CORS enabled for: http://127.0.0.1:5500, http://localhost:5500, http://localhost:3000`);
});