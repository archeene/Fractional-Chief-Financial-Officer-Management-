require('dotenv').config();

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Allow all origins for local development
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Auth check helper - returns error response or null if authenticated
function requireGoogleAuth(res) {
  if (!oAuth2Client.credentials || !oAuth2Client.credentials.access_token) {
    res.status(401).json({
      error: 'Not authenticated',
      message: 'Please visit /auth to authenticate with Google first'
    });
    return true;
  }
  return false;
}

// Google API Scopes - Calendar, Gmail, Sheets, and Contacts
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/contacts.readonly'
];

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

// Legacy endpoint for backward compatibility
app.get('/calendar/:calendarId', async (req, res) => {
  if (requireGoogleAuth(res)) return;

  try {
    const { calendarId } = req.params;
    console.log(`[Legacy] Fetching events for calendar: ${calendarId}`);

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500
    });

    // Get calendar info
    const calendarInfo = await calendar.calendars.get({ calendarId });

    console.log(`[Legacy] Successfully fetched ${response.data.items.length} events`);

    res.json({
      success: true,
      data: {
        events: response.data.items,
        calendarInfo: {
          summary: calendarInfo.data.summary,
          description: calendarInfo.data.description
        }
      }
    });
  } catch (error) {
    console.error('[Legacy] Calendar API error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Make sure you have authenticated with /auth endpoint'
    });
  }
});

// Proxy endpoint for calendar events
app.get('/api/calendar/:calendarId/events', async (req, res) => {
  try {
    if (requireGoogleAuth(res)) return;

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

// ==========================================
// Google Sheets API Endpoints
// ==========================================

// Create a new spreadsheet
app.post('/api/sheets', async (req, res) => {
  try {
    if (requireGoogleAuth(res)) return;

    const { title, data } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    console.log(`Creating new spreadsheet: ${title}`);

    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });

    // Create the spreadsheet
    const createResponse = await sheets.spreadsheets.create({
      resource: {
        properties: {
          title: title
        }
      }
    });

    const spreadsheetId = createResponse.data.spreadsheetId;
    const spreadsheetUrl = createResponse.data.spreadsheetUrl;

    console.log(`✅ Created spreadsheet: ${spreadsheetId}`);

    // If initial data provided, write it to the sheet
    if (data && data.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        resource: { values: data }
      });
      console.log(`✅ Added ${data.length} rows of initial data`);
    }

    res.json({
      success: true,
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: spreadsheetUrl,
      title: title
    });
  } catch (error) {
    console.error('Create spreadsheet error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Get spreadsheet data
app.get('/api/sheets/:spreadsheetId', async (req, res) => {
  try {
    if (requireGoogleAuth(res)) return;

    const { spreadsheetId } = req.params;
    const { range } = req.query;

    console.log(`Fetching spreadsheet: ${spreadsheetId}, range: ${range || 'Sheet1'}`);

    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: range || 'Sheet1'
    });

    res.json({
      success: true,
      data: response.data.values,
      range: response.data.range
    });
  } catch (error) {
    console.error('Sheets API error:', error);
    res.status(500).json({
      error: error.message,
      hint: 'Make sure the spreadsheet is shared with your Google account and you have authenticated'
    });
  }
});

// Get spreadsheet metadata
app.get('/api/sheets/:spreadsheetId/metadata', async (req, res) => {
  try {
    if (requireGoogleAuth(res)) return;

    const { spreadsheetId } = req.params;
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });

    const response = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId
    });

    res.json({
      success: true,
      title: response.data.properties.title,
      sheets: response.data.sheets.map(s => ({
        title: s.properties.title,
        sheetId: s.properties.sheetId,
        rowCount: s.properties.gridProperties.rowCount,
        columnCount: s.properties.gridProperties.columnCount
      }))
    });
  } catch (error) {
    console.error('Sheets metadata error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Write to spreadsheet
app.post('/api/sheets/:spreadsheetId', async (req, res) => {
  try {
    if (requireGoogleAuth(res)) return;

    const { spreadsheetId } = req.params;
    const { range, values } = req.body;

    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });

    res.json({
      success: true,
      updatedCells: response.data.updatedCells,
      updatedRange: response.data.updatedRange
    });
  } catch (error) {
    console.error('Sheets write error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Extract spreadsheet ID from URL
app.get('/api/sheets/parse-url', (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  // Extract spreadsheet ID from Google Sheets URL
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    res.json({
      success: true,
      spreadsheetId: match[1]
    });
  } else {
    res.status(400).json({
      error: 'Invalid Google Sheets URL format'
    });
  }
});

// ==========================================
// Public Google Sheets (No API Key Required)
// Uses CSV export for public sheets - no authentication needed
// ==========================================

// Get public spreadsheet data via CSV export (no API key needed)
app.get('/api/sheets/public/:spreadsheetId', async (req, res) => {
  const { spreadsheetId } = req.params;
  const { gid = '0' } = req.query; // Sheet tab ID, default is first sheet

  try {
    // First, try to get the actual spreadsheet title from the HTML page
    let spreadsheetTitle = null;
    let sheetTabs = [];

    const htmlUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    const htmlResponse = await fetch(htmlUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      redirect: 'follow'
    });

    if (htmlResponse.ok) {
      const html = await htmlResponse.text();

      // Extract title from <title> tag (format: "Sheet Name - Google Sheets")
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        const fullTitle = titleMatch[1];
        // Remove " - Google Sheets" suffix
        spreadsheetTitle = fullTitle.replace(/ - Google Sheets$/, '').trim();
      }

      // Try to extract sheet tab names from the HTML
      // Look for sheet names in the page source
      const sheetNameMatches = html.matchAll(/"name":"([^"]+)","index":(\d+),"sheetId":(\d+)/g);
      for (const match of sheetNameMatches) {
        sheetTabs.push({
          title: match[1],
          index: parseInt(match[2]),
          sheetId: match[3]
        });
      }
    }

    // Now fetch the CSV data
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

    const response = await fetch(csvUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return res.status(404).json({
        success: false,
        error: 'Spreadsheet not found or not publicly accessible',
        hint: 'Make sure the sheet is shared with "Anyone with the link can view/edit"'
      });
    }

    const csvData = await response.text();

    // Check if we got an error page instead of CSV
    if (csvData.includes('<!DOCTYPE html>') || csvData.includes('<html')) {
      return res.status(403).json({
        success: false,
        error: 'Spreadsheet is not publicly accessible',
        hint: 'Make sure the sheet is shared with "Anyone with the link can view/edit"'
      });
    }

    // Parse CSV to get data
    const rows = parseCSV(csvData);

    // Use extracted title or fallback to row count
    const title = spreadsheetTitle || `Untitled Spreadsheet (${rows.length} rows)`;

    // Use extracted sheet tabs or fallback
    const sheets = sheetTabs.length > 0 ? sheetTabs : [{ title: 'Sheet1', sheetId: gid, index: 0 }];

    res.json({
      success: true,
      spreadsheetId: spreadsheetId,
      title: title,
      sheets: sheets,
      data: rows,
      rowCount: rows.length,
      columnCount: rows[0]?.length || 0
    });

  } catch (error) {
    console.error('Public sheets error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Make sure the spreadsheet URL is correct and the sheet is publicly shared'
    });
  }
});

// Helper function to parse CSV
function parseCSV(csvText) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // Skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !insideQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      if (char === '\r') i++; // Skip \n after \r
    } else if (char !== '\r') {
      currentCell += char;
    }
  }

  // Don't forget the last cell/row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Get data from a specific sheet tab in a public spreadsheet
app.get('/api/sheets/public/:spreadsheetId/:gid', async (req, res) => {
  const { spreadsheetId, gid } = req.params;

  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

    const response = await fetch(csvUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch sheet data'
      });
    }

    const csvData = await response.text();

    if (csvData.includes('<!DOCTYPE html>')) {
      return res.status(403).json({
        success: false,
        error: 'Sheet not publicly accessible'
      });
    }

    const rows = parseCSV(csvData);

    res.json({
      success: true,
      gid: gid,
      data: rows,
      rowCount: rows.length,
      columnCount: rows[0]?.length || 0
    });

  } catch (error) {
    console.error('Public sheet data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// Gmail API Endpoints
// ==========================================

// Get Gmail profile info
app.get('/api/gmail/profile', async (req, res) => {
  try {
    if (requireGoogleAuth(res)) return;

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    res.json({
      success: true,
      email: profile.data.emailAddress,
      messagesTotal: profile.data.messagesTotal,
      threadsTotal: profile.data.threadsTotal
    });
  } catch (error) {
    console.error('Gmail profile error:', error);
    res.status(500).json({
      error: error.message,
      hint: 'Make sure you have authenticated with /auth endpoint'
    });
  }
});

// Get list of emails
app.get('/api/gmail/messages', async (req, res) => {
  try {
    if (requireGoogleAuth(res)) return;

    const { maxResults = 20, labelIds = 'INBOX', q } = req.query;

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const listParams = {
      userId: 'me',
      maxResults: parseInt(maxResults),
      labelIds: labelIds.split(',')
    };

    // Add query filter - for INBOX, exclude spam and trash explicitly using Gmail's classification
    if (labelIds === 'INBOX') {
      // Use 'is:' filters which respect Gmail's spam classification more accurately
      listParams.q = q ? `${q} is:inbox -is:spam -is:trash` : 'is:inbox -is:spam -is:trash';
    } else if (q) {
      listParams.q = q;
    }

    console.log(`📧 Gmail fetch - labelIds: ${labelIds}, query: ${listParams.q || 'none'}`);

    const response = await gmail.users.messages.list(listParams);

    if (!response.data.messages || response.data.messages.length === 0) {
      return res.json({
        success: true,
        messages: [],
        resultSizeEstimate: 0
      });
    }

    // Fetch details for each message
    const allMessages = await Promise.all(
      response.data.messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date']
        });

        const headers = detail.data.payload.headers;
        const getHeader = (name) => headers.find(h => h.name === name)?.value || '';

        return {
          id: msg.id,
          threadId: msg.threadId,
          snippet: detail.data.snippet,
          from: getHeader('From'),
          to: getHeader('To'),
          subject: getHeader('Subject'),
          date: getHeader('Date'),
          labelIds: detail.data.labelIds,
          isUnread: detail.data.labelIds?.includes('UNREAD')
        };
      })
    );

    // Filter out spam/trash when viewing inbox (check actual labels on each message)
    let messages = allMessages;
    if (labelIds === 'INBOX') {
      messages = allMessages.filter(msg => {
        const labels = msg.labelIds || [];
        // Exclude messages that are in SPAM or TRASH
        return !labels.includes('SPAM') && !labels.includes('TRASH');
      });
      console.log(`📧 Filtered: ${allMessages.length} -> ${messages.length} (excluded spam/trash)`);
    }

    res.json({
      success: true,
      messages,
      resultSizeEstimate: response.data.resultSizeEstimate
    });
  } catch (error) {
    console.error('Gmail messages error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Get single email with full content
app.get('/api/gmail/messages/:messageId', async (req, res) => {
  try {
    if (requireGoogleAuth(res)) return;

    const { messageId } = req.params;
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const headers = response.data.payload.headers;
    const getHeader = (name) => headers.find(h => h.name === name)?.value || '';

    // Extract body content - prefer HTML over plain text for better formatting
    let body = '';
    const payload = response.data.payload;

    // Helper function to recursively find email body parts
    const findBodyParts = (parts, results = { html: '', plain: '' }) => {
      if (!parts) return results;

      for (const part of parts) {
        if (part.mimeType === 'text/html' && part.body && part.body.data) {
          results.html = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          results.plain = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        // Check nested parts (multipart/alternative, multipart/mixed, etc.)
        if (part.parts) {
          findBodyParts(part.parts, results);
        }
      }
      return results;
    };

    if (payload.body && payload.body.data) {
      // Simple message with body directly in payload
      const content = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      if (payload.mimeType === 'text/html') {
        body = content;
      } else {
        // Plain text - convert to basic HTML with clickable links
        const escapedPlain = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
          .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
        body = `<div style="white-space: pre-wrap; word-wrap: break-word;">${escapedPlain}</div>`;
      }
    } else if (payload.parts) {
      // Multipart message - find HTML first, fallback to plain text
      const bodyParts = findBodyParts(payload.parts);

      if (bodyParts.html) {
        body = bodyParts.html;
      } else if (bodyParts.plain) {
        // Convert plain text to HTML with proper formatting
        const escapedPlain = bodyParts.plain
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
          .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
        body = `<div style="white-space: pre-wrap; word-wrap: break-word;">${escapedPlain}</div>`;
      }
    }

    // If still no body found, use snippet
    if (!body && response.data.snippet) {
      body = `<p>${response.data.snippet}</p>`;
    }

    res.json({
      success: true,
      id: response.data.id,
      threadId: response.data.threadId,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      body,
      snippet: response.data.snippet,
      labelIds: response.data.labelIds
    });
  } catch (error) {
    console.error('Gmail message error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Get Gmail labels (folders)
app.get('/api/gmail/labels', async (req, res) => {
  try {
    if (requireGoogleAuth(res)) return;

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const response = await gmail.users.labels.list({ userId: 'me' });

    res.json({
      success: true,
      labels: response.data.labels
    });
  } catch (error) {
    console.error('Gmail labels error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Send email
app.post('/api/gmail/send', async (req, res) => {
  try {
    if (requireGoogleAuth(res)) return;

    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({
        error: 'Missing required fields: to, subject, body'
      });
    }

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    // Create email in RFC 2822 format
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      body
    ].join('\n');

    const encodedEmail = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });

    res.json({
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId
    });
  } catch (error) {
    console.error('Gmail send error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Mark email as read
app.post('/api/gmail/messages/:messageId/read', async (req, res) => {
  try {
    if (requireGoogleAuth(res)) return;

    const { messageId } = req.params;
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD']
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Gmail mark read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Modify email labels (add/remove labels)
app.post('/api/gmail/messages/:messageId/labels', async (req, res) => {
  try {
    if (requireGoogleAuth(res)) return;

    const { messageId } = req.params;
    const { addLabelIds = [], removeLabelIds = [] } = req.body;

    console.log(`📧 Modifying labels for ${messageId}: +[${addLabelIds.join(',')}] -[${removeLabelIds.join(',')}]`);

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const response = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds,
        removeLabelIds
      }
    });

    res.json({
      success: true,
      labelIds: response.data.labelIds
    });
  } catch (error) {
    console.error('Gmail modify labels error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new Gmail label
app.post('/api/gmail/labels', async (req, res) => {
  try {
    if (requireGoogleAuth(res)) return;

    const { name, labelListVisibility = 'labelShow', messageListVisibility = 'show' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Label name is required' });
    }

    console.log(`📧 Creating new label: ${name}`);

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const response = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name,
        labelListVisibility,
        messageListVisibility
      }
    });

    res.json({
      success: true,
      label: response.data
    });
  } catch (error) {
    console.error('Gmail create label error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Google Contacts API
// ==========================================

// Get Google Contacts
app.get('/api/contacts', async (req, res) => {
  if (requireGoogleAuth(res)) return;

  try {
    const people = google.people({ version: 'v1', auth: oAuth2Client });

    const response = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1000,
      personFields: 'names,emailAddresses,phoneNumbers,organizations,photos'
    });

    const contacts = (response.data.connections || []).map(person => ({
      id: person.resourceName,
      name: person.names?.[0]?.displayName || 'Unknown',
      email: person.emailAddresses?.[0]?.value || '',
      phone: person.phoneNumbers?.[0]?.value || '',
      company: person.organizations?.[0]?.name || '',
      photo: person.photos?.[0]?.url || null
    }));

    res.json({
      success: true,
      contacts,
      total: contacts.length
    });
  } catch (error) {
    console.error('Google Contacts error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    authenticated: fs.existsSync(TOKEN_PATH),
    oauthCredentialsExists: fs.existsSync(OAUTH_CREDENTIALS_PATH),
    quickbooksConfigured: !!(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET)
  });
});

// ==========================================
// QuickBooks OAuth 2.0 Integration
// ==========================================

const QUICKBOOKS_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID;
const QUICKBOOKS_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET;
const QUICKBOOKS_REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:3001/quickbooks/callback';
const QUICKBOOKS_TOKEN_PATH = path.join(__dirname, 'quickbooks-token.json');

// QuickBooks OAuth scopes
const QUICKBOOKS_SCOPES = [
  'com.intuit.quickbooks.accounting'
];

// Store QuickBooks token
let quickbooksToken = null;

// Load QuickBooks token if exists
if (fs.existsSync(QUICKBOOKS_TOKEN_PATH)) {
  try {
    quickbooksToken = JSON.parse(fs.readFileSync(QUICKBOOKS_TOKEN_PATH));
    console.log('✓ Loaded existing QuickBooks token');
  } catch (e) {
    console.error('Failed to load QuickBooks token:', e.message);
  }
}

// QuickBooks authorization endpoint
app.get('/quickbooks/auth', (req, res) => {
  if (!QUICKBOOKS_CLIENT_ID || !QUICKBOOKS_CLIENT_SECRET) {
    return res.status(500).json({
      error: 'QuickBooks credentials not configured',
      message: 'Please set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET in .env file'
    });
  }

  const authUrl = `https://appcenter.intuit.com/connect/oauth2?` +
    `client_id=${QUICKBOOKS_CLIENT_ID}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(QUICKBOOKS_SCOPES.join(' '))}` +
    `&redirect_uri=${encodeURIComponent(QUICKBOOKS_REDIRECT_URI)}` +
    `&state=${Date.now()}`;

  res.redirect(authUrl);
});

// QuickBooks OAuth callback
app.get('/quickbooks/callback', async (req, res) => {
  const { code, realmId, state, error } = req.query;

  if (error) {
    return res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px; background: #0a0e27; color: #00ff41;">
          <h1 style="color: #ff0040;">✗ QuickBooks Authentication Failed</h1>
          <p>Error: ${error}</p>
        </body>
      </html>
    `);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: QUICKBOOKS_REDIRECT_URI
      })
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      throw new Error(tokens.error_description || tokens.error);
    }

    // Store token with realmId
    quickbooksToken = {
      ...tokens,
      realmId: realmId,
      obtained_at: Date.now()
    };

    // Save to file
    fs.writeFileSync(QUICKBOOKS_TOKEN_PATH, JSON.stringify(quickbooksToken, null, 2));
    console.log('✓ QuickBooks token saved successfully');

    res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px; background: #0a0e27; color: #00ff41;">
          <h1 style="color: #00ff41;">✓ QuickBooks Connected!</h1>
          <p>Company ID: ${realmId}</p>
          <p>You can now close this window and return to THE HULL.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('QuickBooks token error:', error);
    res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px; background: #0a0e27; color: #ff0040;">
          <h1>✗ QuickBooks Authentication Failed</h1>
          <p>Error: ${error.message}</p>
        </body>
      </html>
    `);
  }
});

// Check QuickBooks connection status
app.get('/api/quickbooks/status', (req, res) => {
  const isConnected = quickbooksToken && quickbooksToken.access_token;
  res.json({
    connected: isConnected,
    realmId: quickbooksToken?.realmId || null,
    configured: !!(QUICKBOOKS_CLIENT_ID && QUICKBOOKS_CLIENT_SECRET)
  });
});

// Get company info from QuickBooks
app.get('/api/quickbooks/company', async (req, res) => {
  if (!quickbooksToken || !quickbooksToken.access_token) {
    return res.status(401).json({ error: 'QuickBooks not authenticated. Visit /quickbooks/auth first.' });
  }

  try {
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${quickbooksToken.realmId}/companyinfo/${quickbooksToken.realmId}`,
      {
        headers: {
          'Authorization': `Bearer ${quickbooksToken.access_token}`,
          'Accept': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (data.fault) {
      throw new Error(data.fault.error?.[0]?.message || 'QuickBooks API error');
    }

    res.json({ success: true, company: data.CompanyInfo });
  } catch (error) {
    console.error('QuickBooks API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get accounts from QuickBooks
app.get('/api/quickbooks/accounts', async (req, res) => {
  if (!quickbooksToken || !quickbooksToken.access_token) {
    return res.status(401).json({ error: 'QuickBooks not authenticated. Visit /quickbooks/auth first.' });
  }

  try {
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${quickbooksToken.realmId}/query?query=select * from Account`,
      {
        headers: {
          'Authorization': `Bearer ${quickbooksToken.access_token}`,
          'Accept': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (data.fault) {
      throw new Error(data.fault.error?.[0]?.message || 'QuickBooks API error');
    }

    res.json({ success: true, accounts: data.QueryResponse?.Account || [] });
  } catch (error) {
    console.error('QuickBooks API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get profit and loss report
app.get('/api/quickbooks/reports/profit-loss', async (req, res) => {
  if (!quickbooksToken || !quickbooksToken.access_token) {
    return res.status(401).json({ error: 'QuickBooks not authenticated. Visit /quickbooks/auth first.' });
  }

  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${quickbooksToken.realmId}/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}`,
      {
        headers: {
          'Authorization': `Bearer ${quickbooksToken.access_token}`,
          'Accept': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (data.fault) {
      throw new Error(data.fault.error?.[0]?.message || 'QuickBooks API error');
    }

    res.json({ success: true, report: data });
  } catch (error) {
    console.error('QuickBooks API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get customers from QuickBooks
app.get('/api/quickbooks/customers', async (req, res) => {
  if (!quickbooksToken || !quickbooksToken.access_token) {
    return res.status(401).json({ error: 'QuickBooks not authenticated. Visit /quickbooks/auth first.' });
  }

  try {
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${quickbooksToken.realmId}/query?query=select * from Customer MAXRESULTS 100`,
      {
        headers: {
          'Authorization': `Bearer ${quickbooksToken.access_token}`,
          'Accept': 'application/json'
        }
      }
    );
    const data = await response.json();
    if (data.fault) {
      throw new Error(data.fault.error?.[0]?.message || 'QuickBooks API error');
    }
    res.json({ success: true, customers: data.QueryResponse?.Customer || [] });
  } catch (error) {
    console.error('QuickBooks API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get vendors from QuickBooks
app.get('/api/quickbooks/vendors', async (req, res) => {
  if (!quickbooksToken || !quickbooksToken.access_token) {
    return res.status(401).json({ error: 'QuickBooks not authenticated. Visit /quickbooks/auth first.' });
  }

  try {
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${quickbooksToken.realmId}/query?query=select * from Vendor MAXRESULTS 100`,
      {
        headers: {
          'Authorization': `Bearer ${quickbooksToken.access_token}`,
          'Accept': 'application/json'
        }
      }
    );
    const data = await response.json();
    if (data.fault) {
      throw new Error(data.fault.error?.[0]?.message || 'QuickBooks API error');
    }
    res.json({ success: true, vendors: data.QueryResponse?.Vendor || [] });
  } catch (error) {
    console.error('QuickBooks API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get invoices from QuickBooks
app.get('/api/quickbooks/invoices', async (req, res) => {
  if (!quickbooksToken || !quickbooksToken.access_token) {
    return res.status(401).json({ error: 'QuickBooks not authenticated. Visit /quickbooks/auth first.' });
  }

  try {
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${quickbooksToken.realmId}/query?query=select * from Invoice MAXRESULTS 100`,
      {
        headers: {
          'Authorization': `Bearer ${quickbooksToken.access_token}`,
          'Accept': 'application/json'
        }
      }
    );
    const data = await response.json();
    if (data.fault) {
      throw new Error(data.fault.error?.[0]?.message || 'QuickBooks API error');
    }
    res.json({ success: true, invoices: data.QueryResponse?.Invoice || [] });
  } catch (error) {
    console.error('QuickBooks API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get attachables (files) from QuickBooks
app.get('/api/quickbooks/attachables', async (req, res) => {
  if (!quickbooksToken || !quickbooksToken.access_token) {
    return res.status(401).json({ error: 'QuickBooks not authenticated. Visit /quickbooks/auth first.' });
  }

  try {
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${quickbooksToken.realmId}/query?query=select * from Attachable MAXRESULTS 100`,
      {
        headers: {
          'Authorization': `Bearer ${quickbooksToken.access_token}`,
          'Accept': 'application/json'
        }
      }
    );
    const data = await response.json();
    if (data.fault) {
      throw new Error(data.fault.error?.[0]?.message || 'QuickBooks API error');
    }
    res.json({ success: true, attachables: data.QueryResponse?.Attachable || [] });
  } catch (error) {
    console.error('QuickBooks API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get attachables for a specific entity (Customer, Vendor, Invoice, etc.)
app.get('/api/quickbooks/attachables/:entityType/:entityId', async (req, res) => {
  if (!quickbooksToken || !quickbooksToken.access_token) {
    return res.status(401).json({ error: 'QuickBooks not authenticated. Visit /quickbooks/auth first.' });
  }

  const { entityType, entityId } = req.params;

  try {
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${quickbooksToken.realmId}/query?query=select * from Attachable where AttachableRef.EntityRef.Type = '${entityType}' and AttachableRef.EntityRef.value = '${entityId}'`,
      {
        headers: {
          'Authorization': `Bearer ${quickbooksToken.access_token}`,
          'Accept': 'application/json'
        }
      }
    );
    const data = await response.json();
    if (data.fault) {
      throw new Error(data.fault.error?.[0]?.message || 'QuickBooks API error');
    }
    res.json({ success: true, attachables: data.QueryResponse?.Attachable || [] });
  } catch (error) {
    console.error('QuickBooks API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download an attachable file from QuickBooks
app.get('/api/quickbooks/attachables/:attachableId/download', async (req, res) => {
  if (!quickbooksToken || !quickbooksToken.access_token) {
    return res.status(401).json({ error: 'QuickBooks not authenticated. Visit /quickbooks/auth first.' });
  }

  const { attachableId } = req.params;

  try {
    // First get the attachable metadata
    const metaResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${quickbooksToken.realmId}/attachable/${attachableId}`,
      {
        headers: {
          'Authorization': `Bearer ${quickbooksToken.access_token}`,
          'Accept': 'application/json'
        }
      }
    );
    const metaData = await metaResponse.json();

    if (metaData.fault) {
      throw new Error(metaData.fault.error?.[0]?.message || 'QuickBooks API error');
    }

    const attachable = metaData.Attachable;
    if (!attachable || !attachable.TempDownloadUri) {
      return res.status(404).json({ error: 'Attachable file not found or no download URL available' });
    }

    // Return the download URL and metadata
    res.json({
      success: true,
      attachable: {
        id: attachable.Id,
        fileName: attachable.FileName,
        fileType: attachable.ContentType,
        size: attachable.Size,
        downloadUrl: attachable.TempDownloadUri,
        note: attachable.Note
      }
    });
  } catch (error) {
    console.error('QuickBooks API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get QuickBooks URL for online access (opens in browser)
app.get('/api/quickbooks/url', (req, res) => {
  if (!quickbooksToken || !quickbooksToken.realmId) {
    return res.status(401).json({ error: 'QuickBooks not authenticated' });
  }

  // QuickBooks Online URL format
  const qboUrl = `https://app.qbo.intuit.com/app/homepage?companyId=${quickbooksToken.realmId}`;
  res.json({ success: true, url: qboUrl, realmId: quickbooksToken.realmId });
});

// ==========================================
// Flight Data API (AviationStack / FlightAware)
// ==========================================

// Flight API endpoints removed - flights are static pins only, no external API calls

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