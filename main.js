const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

// Whisper.cpp for offline transcription
let whisper = null;
const ffmpegPath = require('ffmpeg-static');
const WHISPER_MODEL_PATH = path.join(__dirname, 'models', 'ggml-base.en.bin');

// Load environment variables from .env file (explicit path)
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Venice API Configuration
const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_MODEL = process.env.VENICE_MODEL || 'zai-org-glm-4.7';

if (VENICE_API_KEY) {
  console.log('✅ Venice API key loaded:', VENICE_API_KEY.substring(0, 20) + '...');
  console.log('✅ Model:', VENICE_MODEL);
} else {
  console.error('❌ VENICE_API_KEY not found in .env file');
}

// OAuth credentials file path
const OAUTH_CREDENTIALS_PATH = path.join(__dirname, 'oauth-credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

let oAuth2Client = null;
let serverProcess = null;

// ============================================
// STORAGE SETTINGS - User-configurable file storage
// ============================================
const STORAGE_SETTINGS_PATH = path.join(__dirname, 'storage-settings.json');

// Default storage location
function getDefaultStorageFolder() {
  return path.join(__dirname, 'UserFiles');
}

// Load storage settings
function loadStorageSettings() {
  try {
    if (fs.existsSync(STORAGE_SETTINGS_PATH)) {
      const settings = JSON.parse(fs.readFileSync(STORAGE_SETTINGS_PATH, 'utf8'));
      // Validate the folder still exists
      if (settings.storageFolder && fs.existsSync(settings.storageFolder)) {
        return settings;
      }
    }
  } catch (error) {
    console.error('Error loading storage settings:', error);
  }
  return { storageFolder: getDefaultStorageFolder() };
}

// Save storage settings
function saveStorageSettings(settings) {
  try {
    fs.writeFileSync(STORAGE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving storage settings:', error);
    return false;
  }
}

// Get current storage folder
function getStorageFolder() {
  const settings = loadStorageSettings();
  return settings.storageFolder;
}

// Kill any existing process on port 3001 before starting server
function killPortProcess() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // Windows: find and kill process on port 3001
      const findProcess = spawn('cmd', ['/c', 'for /f "tokens=5" %a in (\'netstat -ano ^| findstr :3001 ^| findstr LISTENING\') do taskkill /F /PID %a'], {
        shell: true,
        stdio: 'pipe'
      });
      findProcess.on('close', () => resolve());
      findProcess.on('error', () => resolve());
      setTimeout(resolve, 1000); // Timeout fallback
    } else {
      // Mac/Linux: use lsof and kill
      const findProcess = spawn('sh', ['-c', 'lsof -ti:3001 | xargs kill -9 2>/dev/null || true']);
      findProcess.on('close', () => resolve());
      findProcess.on('error', () => resolve());
      setTimeout(resolve, 1000);
    }
  });
}

// Start the Express server automatically
async function startServer() {
  console.log('Killing any existing process on port 3001...');
  await killPortProcess();

  console.log('Starting Express server...');
  serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });

  // Handle server stdout
  serverProcess.stdout.on('data', (data) => {
    try {
      console.log(`[Server] ${data.toString().trim()}`);
    } catch (e) {
      // Ignore write errors (EPIPE)
    }
  });

  // Handle server stderr
  serverProcess.stderr.on('data', (data) => {
    try {
      console.error(`[Server Error] ${data.toString().trim()}`);
    } catch (e) {
      // Ignore write errors (EPIPE)
    }
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
    width: 1600,
    height: 1000,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true  // Enable webview for LinkedIn integration
    }
  });

  win.loadFile('dashboard.html');
  // win.webContents.openDevTools(); // Uncomment for debugging

  // Load calendar data on startup if authenticated
  // Disabled auto-loading - user will manually import calendars via UI
  // if (oAuth2Client && oAuth2Client.credentials && oAuth2Client.credentials.access_token) {
  //   loadCalendarData();
  // }
}

async function loadCalendarData() {
  const data = await getCalendarEvents();
  if (data) {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('calendar-data', data);
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

// Helper function to scan storage folder for files
function scanStorageFolder() {
  const storageFolder = getStorageFolder();
  const filesSummary = [];

  if (!fs.existsSync(storageFolder)) {
    return filesSummary;
  }

  try {
    // Scan each category folder
    const categoryFolders = fs.readdirSync(storageFolder, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    categoryFolders.forEach(category => {
      const categoryPath = path.join(storageFolder, category);
      const subFolders = fs.readdirSync(categoryPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      subFolders.forEach(subFolder => {
        const subFolderPath = path.join(categoryPath, subFolder);
        const allFiles = fs.readdirSync(subFolderPath, { withFileTypes: true })
          .filter(dirent => dirent.isFile())
          .map(dirent => dirent.name);

        // Separate regular files from system files
        const regularFiles = allFiles.filter(f => !f.startsWith('_') && !f.startsWith('.'));
        const hasCardInfo = allFiles.includes('_card_info.json');

        // Read card info if exists (for CRM contacts)
        let cardInfo = null;
        if (hasCardInfo) {
          try {
            const cardPath = path.join(subFolderPath, '_card_info.json');
            cardInfo = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
          } catch (e) {
            // Ignore read errors
          }
        }

        // Include folder if it has any files OR has card info
        if (regularFiles.length > 0 || hasCardInfo) {
          filesSummary.push({
            category: category,
            owner: subFolder,
            files: regularFiles,
            fileCount: regularFiles.length,
            hasCardInfo: hasCardInfo,
            cardInfo: cardInfo // Include card data for AI context
          });
        }
      });
    });
  } catch (error) {
    console.error('Error scanning storage folder:', error);
  }

  return filesSummary;
}

// Text file extensions for content reading
const TEXT_EXTENSIONS = ['.txt', '.json', '.csv', '.md', '.html', '.xml', '.log'];
const EXTENDED_TEXT_EXTENSIONS = [...TEXT_EXTENSIONS, '.js', '.ts', '.css', '.py', '.sql'];

// Helper function to read text-based files for context
function readFileContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!TEXT_EXTENSIONS.includes(ext)) {
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.substring(0, 5000);
  } catch {
    return null;
  }
}

// ============================================
// AI Tool Execution Functions (Gmail/Sheets)
// ============================================

// Execute create_spreadsheet tool
async function executeCreateSpreadsheet(args) {
  try {
    const response = await fetch('http://localhost:3001/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: args.title,
        data: args.data || []
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to create spreadsheet' };
    }

    const result = await response.json();
    return {
      success: true,
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      message: `Created spreadsheet "${args.title}"`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Execute edit_spreadsheet tool
async function executeEditSpreadsheet(args) {
  try {
    const response = await fetch(`http://localhost:3001/api/sheets/${args.spreadsheetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        range: args.range,
        values: args.values
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to edit spreadsheet' };
    }

    const result = await response.json();
    return {
      success: true,
      updatedCells: result.updatedCells,
      message: `Updated ${result.updatedCells} cells in range ${args.range}`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Execute send_email tool
async function executeSendEmail(args) {
  try {
    const response = await fetch('http://localhost:3001/api/gmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: args.to,
        subject: args.subject,
        body: args.body
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to send email' };
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.id,
      message: `Email sent to ${args.to} with subject "${args.subject}"`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Execute read_file tool - Read contents of files in the user's storage folder
async function executeReadFile(args) {
  try {
    const storageFolder = getStorageFolder();
    const { category, owner, filename } = args;

    // Build the file path safely within the storage folder
    const filePath = path.join(storageFolder, category, owner, filename);

    // Security check: ensure the path is within the storage folder
    const resolvedPath = path.resolve(filePath);
    const resolvedStorage = path.resolve(storageFolder);
    if (!resolvedPath.startsWith(resolvedStorage)) {
      return { success: false, error: 'Access denied: path outside storage folder' };
    }

    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${category}/${owner}/${filename}` };
    }

    const ext = path.extname(filename).toLowerCase();
    const stats = fs.statSync(filePath);

    // Check file size (limit to 100KB for text files)
    if (stats.size > 100 * 1024) {
      return {
        success: true,
        content: `[File too large to read: ${(stats.size / 1024).toFixed(1)}KB. Only first 100KB shown.]`,
        truncated: true,
        partialContent: fs.readFileSync(filePath, 'utf8').substring(0, 100 * 1024)
      };
    }

    // Text-based files
    if (EXTENDED_TEXT_EXTENSIONS.includes(ext)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return {
        success: true,
        content: content,
        filename: filename,
        size: stats.size,
        type: 'text'
      };
    }

    // For non-text files, return metadata only
    return {
      success: true,
      content: `[Binary file: ${filename}, Size: ${(stats.size / 1024).toFixed(1)}KB, Type: ${ext}]`,
      filename: filename,
      size: stats.size,
      type: 'binary'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Execute get_emails tool - Get emails from Gmail
async function executeGetEmails(args) {
  try {
    const maxResults = Math.min(args.maxResults || 10, 50);
    const query = args.query || '';

    const response = await fetch(`http://localhost:3001/api/gmail/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`);

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to fetch emails' };
    }

    const data = await response.json();

    // Format emails for AI consumption
    const emails = (data.messages || []).map(msg => ({
      id: msg.id,
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      date: msg.date,
      snippet: msg.snippet,
      body: msg.body ? msg.body.substring(0, 2000) : null // Limit body size
    }));

    return {
      success: true,
      emails: emails,
      count: emails.length,
      query: query || 'all'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Execute get_calendar_events tool - Get calendar events
async function executeGetCalendarEvents(args) {
  try {
    const days = Math.min(args.days || 7, 30);
    const calendarId = args.calendarId || 'primary';

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch(`http://localhost:3001/api/calendar/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}`);

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to fetch calendar events' };
    }

    const data = await response.json();

    // Format events for AI consumption
    const events = (data.events || []).map(evt => ({
      id: evt.id,
      title: evt.summary,
      description: evt.description,
      location: evt.location,
      start: evt.start?.dateTime || evt.start?.date,
      end: evt.end?.dateTime || evt.end?.date,
      attendees: evt.attendees?.map(a => a.email) || []
    }));

    return {
      success: true,
      events: events,
      count: events.length,
      timeRange: `Next ${days} days`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Execute list_files tool - List all files in storage with full paths
async function executeListFiles(args) {
  try {
    const storageFolder = getStorageFolder();
    const { category, owner } = args || {};
    const filesList = [];

    // If specific category/owner provided, list only that folder
    if (category && owner) {
      const folderPath = path.join(storageFolder, category, owner);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath)
          .filter(f => !f.startsWith('.') && !f.startsWith('_'));
        files.forEach(file => {
          const filePath = path.join(folderPath, file);
          const stats = fs.statSync(filePath);
          filesList.push({
            category,
            owner,
            filename: file,
            size: stats.size,
            modified: stats.mtime.toISOString()
          });
        });
      }
    } else {
      // List all files
      const filesData = scanStorageFolder();
      filesData.forEach(folder => {
        folder.files.forEach(file => {
          const filePath = path.join(storageFolder, folder.category, folder.owner, file);
          try {
            const stats = fs.statSync(filePath);
            filesList.push({
              category: folder.category,
              owner: folder.owner,
              filename: file,
              size: stats.size,
              modified: stats.mtime.toISOString()
            });
          } catch (e) {
            // File may have been deleted
          }
        });
      });
    }

    return {
      success: true,
      files: filesList,
      count: filesList.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// IPC handler for AI Chat (using Venice API with Claude Opus 4.5)
ipcMain.handle('call-claude-api', async (event, userMessage, context) => {
  console.log('🤖 AI Chat request received');

  if (!VENICE_API_KEY) {
    console.error('❌ Venice API key not configured');
    return {
      success: false,
      error: 'API key not configured. Please add VENICE_API_KEY to .env file.'
    };
  }

  try {
    // Use custom model from context if provided, otherwise use default
    const modelToUse = context && context.model ? context.model : VENICE_MODEL;
    console.log('📤 Sending request to Venice API...');
    console.log('   Model:', modelToUse);

    // Build system prompt with context
    // Use custom systemPrompt from context if provided (for standalone features like flight tracker)
    const hasCustomPrompt = context && context.systemPrompt;
    let systemPrompt = hasCustomPrompt
      ? context.systemPrompt
      : 'You are a helpful AI assistant integrated into THE HULL business battlestation. Provide concise, professional responses to help the user with their business needs. You have persistent memory of the conversation - remember what the user has told you and refer back to previous messages when relevant.';

    // Skip adding extra context if using a custom system prompt (e.g., flight tracker needs strict format)
    // Add Google Sheets context if available
    if (!hasCustomPrompt && context && context.sheets && context.sheets.length > 0) {
      systemPrompt += '\n\nYou have access to the following connected Google Sheets:';
      context.sheets.forEach((sheet, i) => {
        systemPrompt += `\n${i + 1}. "${sheet.title}" (ID: ${sheet.id})`;
        if (sheet.data && sheet.data.length > 0) {
          systemPrompt += `\n   Data preview (first 5 rows): ${JSON.stringify(sheet.data.slice(0, 5))}`;
        }
      });
      systemPrompt += '\n\nWhen the user asks about spreadsheet data, use this information to help them.';
    }

    // Add uploaded files context if available (skip for custom prompts)
    console.log('📎 Context files check:', context?.files?.length || 0, 'files');
    if (!hasCustomPrompt && context && context.files && context.files.length > 0) {
      console.log('📎 Adding', context.files.length, 'uploaded files to system prompt');
      systemPrompt += '\n\n📎 UPLOADED FILES - The user has uploaded the following files for you to analyze:';
      context.files.forEach((file, i) => {
        console.log(`   File ${i + 1}: ${file.name} (${file.type})`);
        systemPrompt += `\n\n--- FILE ${i + 1}: ${file.name} ---`;
        if (file.type === 'text') {
          // Limit file content to prevent token overflow
          const content = file.data.length > 10000 ? file.data.substring(0, 10000) + '\n... [content truncated]' : file.data;
          systemPrompt += `\nContent:\n${content}`;
          console.log(`   Content length: ${file.data.length} chars`);
        } else if (file.type === 'image') {
          systemPrompt += `\n[Image file - base64 encoded, ${file.data.length} chars]`;
        }
      });
      systemPrompt += '\n\nUse these uploaded files to answer the user\'s questions. Reference specific content from the files when relevant.';
    } else {
      console.log('📎 No uploaded files in context');
    }

    // Add UserFiles context - scan the storage folder (skip for custom prompts)
    if (!hasCustomPrompt) {
      const storageFolder = getStorageFolder();
      const filesData = scanStorageFolder();

      if (filesData.length > 0) {
        systemPrompt += `\n\nYou have access to the user's saved files stored in: ${storageFolder}`;

        // Separate CRM contacts from regular files
        const crmContacts = filesData.filter(f => f.hasCardInfo && ['Clients', 'Employees', 'Leads'].includes(f.category));
        const otherFiles = filesData.filter(f => !crmContacts.includes(f));

        // Add CRM contacts section
        if (crmContacts.length > 0) {
          systemPrompt += '\n\n👥 CRM CONTACTS (Clients, Employees, Leads):';
          crmContacts.forEach(contact => {
            const info = contact.cardInfo || {};
            systemPrompt += `\n\n- [${contact.category}] ${contact.owner}`;
            if (info.name) systemPrompt += ` - Name: ${info.name}`;
            if (info.company) systemPrompt += `, Company: ${info.company}`;
            if (info.email) systemPrompt += `, Email: ${info.email}`;
            if (info.phone) systemPrompt += `, Phone: ${info.phone}`;
            if (info.position || info.role) systemPrompt += `, Role: ${info.position || info.role}`;
            if (info.notes) systemPrompt += `, Notes: ${info.notes.substring(0, 200)}`;
            if (contact.fileCount > 0) {
              systemPrompt += `\n  Files: ${contact.files.slice(0, 3).join(', ')}${contact.files.length > 3 ? '...' : ''}`;
            }
          });
        }

        // Add other files section
        if (otherFiles.length > 0) {
          systemPrompt += '\n\nFile structure summary:';
          otherFiles.forEach(folder => {
            systemPrompt += `\n- ${folder.category}/${folder.owner}: ${folder.fileCount} files (${folder.files.slice(0, 5).join(', ')}${folder.files.length > 5 ? '...' : ''})`;
          });
        }

        systemPrompt += '\n\nIMPORTANT: You can READ file contents using the read_file tool. When the user asks about a file, transcription, document, or wants you to analyze/summarize something, use read_file with the category, owner, and filename. Use list_files first if you need to find the exact filename.';
      }
    }

    // Add emails context if available (from the app's email tab)
    if (!hasCustomPrompt && context && context.emails && context.emails.length > 0) {
      systemPrompt += '\n\n📧 USER\'S RECENT EMAILS (from their Gmail inbox):';
      context.emails.forEach((email, i) => {
        systemPrompt += `\n\n--- Email ${i + 1} ---`;
        systemPrompt += `\nFrom: ${email.from || 'Unknown'}`;
        systemPrompt += `\nTo: ${email.to || 'Unknown'}`;
        systemPrompt += `\nSubject: ${email.subject || '(no subject)'}`;
        systemPrompt += `\nDate: ${email.date || 'Unknown'}`;
        if (email.snippet) {
          systemPrompt += `\nPreview: ${email.snippet}`;
        }
        if (email.body) {
          systemPrompt += `\nBody: ${email.body}`;
        }
      });
      systemPrompt += '\n\nYou can reference these emails when the user asks about their inbox, messages, or specific emails.';
      console.log(`📧 Added ${context.emails.length} emails to context`);
    }

    // Add calendar events context if available (from the app's calendar tab)
    if (!hasCustomPrompt && context && context.calendarEvents && context.calendarEvents.length > 0) {
      systemPrompt += '\n\n📅 USER\'S CALENDAR EVENTS:';
      context.calendarEvents.forEach((evt, i) => {
        systemPrompt += `\n- ${evt.title || 'Untitled'}: ${evt.start || 'No date'}`;
        if (evt.end) systemPrompt += ` to ${evt.end}`;
        if (evt.location) systemPrompt += ` @ ${evt.location}`;
        if (evt.description) systemPrompt += ` - ${evt.description.substring(0, 100)}`;
      });
      systemPrompt += '\n\nYou can reference these events when the user asks about their schedule, appointments, or calendar.';
      console.log(`📅 Added ${context.calendarEvents.length} calendar events to context`);
    }

    // Build messages array with conversation history
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];

    // Add conversation history if available
    if (context && context.conversationHistory && context.conversationHistory.length > 0) {
      console.log(`💬 Including ${context.conversationHistory.length} previous messages in context`);
      context.conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }

    // Add the current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    // Define tools for Gmail and Sheets operations (only for main chat, not custom prompts)
    const tools = hasCustomPrompt ? undefined : [
      {
        type: "function",
        function: {
          name: "create_spreadsheet",
          description: "Create a new Google Sheets spreadsheet with optional initial data",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Title for the new spreadsheet" },
              data: {
                type: "array",
                description: "2D array of data to populate the sheet (rows of cells)",
                items: { type: "array", items: { type: "string" } }
              }
            },
            required: ["title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "edit_spreadsheet",
          description: "Edit cells in an existing Google Sheet",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: { type: "string", description: "The Google Sheet ID" },
              range: { type: "string", description: "Cell range in A1 notation (e.g., 'Sheet1!A1:B2')" },
              values: {
                type: "array",
                description: "2D array of values to write",
                items: { type: "array", items: { type: "string" } }
              }
            },
            required: ["spreadsheetId", "range", "values"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "send_email",
          description: "Send an email via Gmail",
          parameters: {
            type: "object",
            properties: {
              to: { type: "string", description: "Recipient email address" },
              subject: { type: "string", description: "Email subject line" },
              body: { type: "string", description: "Email body content (plain text or HTML)" }
            },
            required: ["to", "subject", "body"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "read_file",
          description: "Read the contents of a file from the user's storage folder. Use this to access uploaded documents, transcriptions, or any saved files. Files are organized by category (Clients, Employees, Leads, Transcriptions, etc.) and owner name.",
          parameters: {
            type: "object",
            properties: {
              category: { type: "string", description: "The category folder (e.g., 'Clients', 'Employees', 'Leads', 'Transcriptions', 'Misc')" },
              owner: { type: "string", description: "The owner/subfolder name (e.g., client name, 'Audio Recordings', 'Transcriptions')" },
              filename: { type: "string", description: "The exact filename to read" }
            },
            required: ["category", "owner", "filename"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_files",
          description: "List all files in the user's storage folder. Optionally filter by category and owner.",
          parameters: {
            type: "object",
            properties: {
              category: { type: "string", description: "Filter by category folder (e.g., 'Clients', 'Transcriptions')" },
              owner: { type: "string", description: "Filter by owner/subfolder name" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_emails",
          description: "Get recent emails from the user's Gmail inbox. Use this when the user asks about their emails, messages, or inbox.",
          parameters: {
            type: "object",
            properties: {
              maxResults: { type: "number", description: "Maximum number of emails to return (default 10, max 50)" },
              query: { type: "string", description: "Optional Gmail search query (e.g., 'from:someone@email.com', 'subject:meeting', 'is:unread')" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_calendar_events",
          description: "Get calendar events from the user's Google Calendar. Use this when the user asks about their schedule, appointments, meetings, or events.",
          parameters: {
            type: "object",
            properties: {
              days: { type: "number", description: "Number of days to look ahead (default 7, max 30)" },
              calendarId: { type: "string", description: "Calendar ID (default 'primary')" }
            }
          }
        }
      }
    ];

    const requestBody = {
      model: modelToUse,
      messages: messages,
      max_tokens: parseInt(process.env.VENICE_MAX_TOKENS || '4096'),
      temperature: 0.7
    };

    // Only add tools if not using custom prompt
    if (tools) {
      requestBody.tools = tools;
      requestBody.tool_choice = "auto";
    }

    const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Venice API error:', response.status, errorData);
      return {
        success: false,
        error: errorData.error?.message || `API request failed with status ${response.status}`
      };
    }

    const data = await response.json();
    console.log('✅ Venice API response received');

    // Check if AI wants to call tools
    const assistantMessage = data.choices[0].message;
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log('🔧 AI requested tool calls:', assistantMessage.tool_calls.length);

      // Tool execution dispatch map
      const toolHandlers = {
        create_spreadsheet: executeCreateSpreadsheet,
        edit_spreadsheet: executeEditSpreadsheet,
        send_email: executeSendEmail,
        read_file: executeReadFile,
        list_files: executeListFiles,
        get_emails: executeGetEmails,
        get_calendar_events: executeGetCalendarEvents
      };

      // Execute each tool call
      const toolResults = await Promise.all(
        assistantMessage.tool_calls.map(async (toolCall) => {
          const functionName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          console.log(`   Executing: ${functionName}`, args);

          let result;
          const handler = toolHandlers[functionName];
          if (handler) {
            try {
              result = await handler(args);
            } catch (err) {
              result = { success: false, error: err.message };
            }
          } else {
            result = { success: false, error: `Unknown function: ${functionName}` };
          }

          return {
            tool_call_id: toolCall.id,
            role: "tool",
            content: JSON.stringify(result)
          };
        })
      );

      // Send tool results back to AI for final response
      const followUpMessages = [
        ...messages,
        assistantMessage,
        ...toolResults
      ];

      const followUpResponse = await fetch('https://api.venice.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VENICE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: followUpMessages,
          max_tokens: parseInt(process.env.VENICE_MAX_TOKENS || '4096'),
          temperature: 0.7
        })
      });

      if (!followUpResponse.ok) {
        const errorData = await followUpResponse.json();
        return {
          success: false,
          error: errorData.error?.message || 'Failed to get final response after tool execution'
        };
      }

      const followUpData = await followUpResponse.json();
      return {
        success: true,
        response: followUpData.choices[0].message.content,
        toolsExecuted: assistantMessage.tool_calls.map(tc => tc.function.name)
      };
    }

    return {
      success: true,
      response: assistantMessage.content
    };

  } catch (error) {
    console.error('❌ Venice API Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC handler for secure environment variable access (whitelist only)
ipcMain.handle('get-env-var', async (event, key) => {
  // Whitelist of allowed environment variables (never expose API keys)
  const allowedVars = ['CLAUDE_MODEL', 'CLAUDE_MAX_TOKENS'];

  if (allowedVars.includes(key)) {
    return process.env[key] || null;
  }

  console.warn(`⚠️ Attempt to access non-whitelisted env var: ${key}`);
  return null;
});

// IPC handler for opening external URLs (shell.openExternal doesn't work in sandboxed renderer)
ipcMain.handle('open-external-url', async (event, url) => {
  console.log('🌐 Opening external URL:', url);
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to open external URL:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.on('refresh-calendar', () => {
  loadCalendarData();
});

// ============================================
// FILE STORAGE - User-configurable file storage with organized structure
// Folder structure:
//   [Storage Folder]/
//     Clients/
//       [Client Name]/
//         files...
//     Employees/
//       [Employee Name]/
//         files...
//     Leads/
//       [Lead Name]/
//         files...
// ============================================

// Get the files storage directory (uses configurable storage folder)
function getFilesDir() {
  const storageFolder = getStorageFolder();
  if (!fs.existsSync(storageFolder)) {
    fs.mkdirSync(storageFolder, { recursive: true });
  }
  return storageFolder;
}

// Map owner types to human-readable folder names
function getOwnerFolderName(ownerType) {
  const folderNames = {
    'client': 'Clients',
    'employee': 'Employees',
    'lead': 'Leads',
    'sheets': 'Google Sheets',
    'quickbooks': 'QuickBooks',
    'transcription': 'Transcriptions',
    'misc': 'Misc'
  };
  return folderNames[ownerType] || ownerType;
}

// Sanitize name for folder/file names
function sanitizeName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}

// IPC Handlers for Storage Settings
ipcMain.handle('select-storage-folder', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Select Storage Folder for THE HULL Files',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Select Folder'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const selectedFolder = result.filePaths[0];

    // Create THE HULL subfolder
    const hullFolder = path.join(selectedFolder, 'THE HULL Files');
    if (!fs.existsSync(hullFolder)) {
      fs.mkdirSync(hullFolder, { recursive: true });
    }

    // Create category subfolders
    ['Clients', 'Employees', 'Leads', 'Google Sheets', 'QuickBooks', 'Misc'].forEach(folder => {
      const subFolder = path.join(hullFolder, folder);
      if (!fs.existsSync(subFolder)) {
        fs.mkdirSync(subFolder, { recursive: true });
      }
    });

    // Save the setting
    const saved = saveStorageSettings({ storageFolder: hullFolder });

    if (saved) {
      console.log(`✅ Storage folder set to: ${hullFolder}`);
      return { success: true, folder: hullFolder };
    } else {
      return { success: false, error: 'Failed to save settings' };
    }
  } catch (error) {
    console.error('❌ Error selecting storage folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-storage-settings', async () => {
  try {
    const settings = loadStorageSettings();
    return {
      success: true,
      storageFolder: settings.storageFolder,
      isDefault: settings.storageFolder === getDefaultStorageFolder()
    };
  } catch (error) {
    console.error('❌ Error getting storage settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-storage-folder', async (event, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const saved = saveStorageSettings({ storageFolder: folderPath });
    return { success: saved };
  } catch (error) {
    console.error('❌ Error setting storage folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-storage-folder', async () => {
  try {
    const folder = getStorageFolder();
    if (fs.existsSync(folder)) {
      await shell.openPath(folder);
      return { success: true };
    } else {
      return { success: false, error: 'Storage folder does not exist' };
    }
  } catch (error) {
    console.error('❌ Error opening storage folder:', error);
    return { success: false, error: error.message };
  }
});

// Create card folder and save card info when a personal info card is created
ipcMain.handle('create-card-folder', async (event, { ownerType, ownerId, ownerName, cardData }) => {
  try {
    const filesDir = getFilesDir();
    const ownerFolderName = getOwnerFolderName(ownerType);
    const ownerFolderLabel = ownerName ? sanitizeName(ownerName) : ownerId;
    const ownerDir = path.join(filesDir, ownerFolderName, ownerFolderLabel);

    // Create folder if it doesn't exist
    if (!fs.existsSync(ownerDir)) {
      fs.mkdirSync(ownerDir, { recursive: true });
    }

    // Save card info as JSON file
    const cardInfoPath = path.join(ownerDir, '_card_info.json');
    const cardInfo = {
      id: ownerId,
      name: ownerName,
      type: ownerType,
      createdAt: new Date().toISOString(),
      ...cardData
    };
    // Remove photo from stored card info (it's saved separately)
    const cardInfoWithoutPhoto = { ...cardInfo };
    delete cardInfoWithoutPhoto.photo;
    fs.writeFileSync(cardInfoPath, JSON.stringify(cardInfoWithoutPhoto, null, 2));

    // Initialize metadata for this folder
    const metadataPath = path.join(ownerDir, '.metadata.json');
    let metadata = {};
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }

    // Add card info file to metadata
    const cardInfoStats = fs.statSync(cardInfoPath);
    metadata['_card_info.json'] = {
      originalName: `${ownerName || ownerId} - Info Card.json`,
      type: 'application/json',
      size: cardInfoStats.size,
      uploadDate: new Date().toISOString(),
      ownerId: ownerId,
      ownerName: ownerName || null,
      isCardInfo: true
    };

    // If there's a photo, save it as a separate file
    if (cardData.photo && cardData.photo.startsWith('data:')) {
      const photoMatch = cardData.photo.match(/^data:([^;]+);base64,(.+)$/);
      if (photoMatch) {
        const mimeType = photoMatch[1];
        const base64Data = photoMatch[2];
        const ext = mimeType.split('/')[1] || 'jpg';
        const photoFileName = `_profile_photo.${ext}`;
        const photoPath = path.join(ownerDir, photoFileName);
        fs.writeFileSync(photoPath, Buffer.from(base64Data, 'base64'));

        // Add photo to metadata
        const photoStats = fs.statSync(photoPath);
        metadata[photoFileName] = {
          originalName: `${ownerName || ownerId} - Profile Photo.${ext}`,
          type: mimeType,
          size: photoStats.size,
          uploadDate: new Date().toISOString(),
          ownerId: ownerId,
          ownerName: ownerName || null,
          isProfilePhoto: true
        };

        console.log(`✅ Saved profile photo: ${photoPath}`);
      }
    }

    // Save metadata
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`✅ Created card folder: ${ownerDir}`);
    return { success: true, folderPath: ownerDir };
  } catch (error) {
    console.error('❌ Error creating card folder:', error);
    return { success: false, error: error.message };
  }
});

// Move lead folder to clients folder when converting to client
ipcMain.handle('move-lead-to-client', async (event, { leadId, leadName, clientId, clientName }) => {
  try {
    const filesDir = getFilesDir();
    const leadsFolder = path.join(filesDir, 'Leads');
    const clientsFolder = path.join(filesDir, 'Clients');

    // Find the lead folder (by name)
    const leadFolderName = sanitizeName(leadName);
    const leadFolderPath = path.join(leadsFolder, leadFolderName);

    // Create clients folder if it doesn't exist
    if (!fs.existsSync(clientsFolder)) {
      fs.mkdirSync(clientsFolder, { recursive: true });
    }

    // Destination client folder (use same name)
    const clientFolderName = sanitizeName(clientName);
    const clientFolderPath = path.join(clientsFolder, clientFolderName);

    // Check if lead folder exists
    if (!fs.existsSync(leadFolderPath)) {
      console.log(`Lead folder not found: ${leadFolderPath}, creating new client folder`);
      // Create new client folder since lead folder doesn't exist
      if (!fs.existsSync(clientFolderPath)) {
        fs.mkdirSync(clientFolderPath, { recursive: true });
      }
      return { success: true, folderPath: clientFolderPath, moved: false };
    }

    // If destination already exists, append a number
    let finalClientPath = clientFolderPath;
    let counter = 1;
    while (fs.existsSync(finalClientPath)) {
      finalClientPath = path.join(clientsFolder, `${clientFolderName}_${counter}`);
      counter++;
    }

    // Move the folder (rename)
    fs.renameSync(leadFolderPath, finalClientPath);

    // Update the _card_info.json to reflect new type
    const cardInfoPath = path.join(finalClientPath, '_card_info.json');
    if (fs.existsSync(cardInfoPath)) {
      const cardInfo = JSON.parse(fs.readFileSync(cardInfoPath, 'utf8'));
      cardInfo.type = 'client';
      cardInfo.id = clientId;
      cardInfo.convertedFromLead = leadId;
      cardInfo.convertedAt = new Date().toISOString();
      fs.writeFileSync(cardInfoPath, JSON.stringify(cardInfo, null, 2));
    }

    // Update metadata file
    const metadataPath = path.join(finalClientPath, '.metadata.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      // Update owner references in metadata
      Object.keys(metadata).forEach(key => {
        if (metadata[key].ownerId === leadId) {
          metadata[key].ownerId = clientId;
          metadata[key].ownerName = clientName;
        }
      });
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }

    console.log(`✅ Moved lead folder to clients: ${leadFolderPath} -> ${finalClientPath}`);
    return { success: true, folderPath: finalClientPath, moved: true };
  } catch (error) {
    console.error('❌ Error moving lead to client:', error);
    return { success: false, error: error.message };
  }
});

// Save a file to disk with organized folder structure
ipcMain.handle('save-file', async (event, { ownerType, ownerId, ownerName, fileName, fileData, fileType, fileSize }) => {
  try {
    const filesDir = getFilesDir();
    const ownerFolderName = getOwnerFolderName(ownerType);

    // Use owner name for folder if provided, otherwise use ID
    const ownerFolderLabel = ownerName ? sanitizeName(ownerName) : ownerId;
    const ownerDir = path.join(filesDir, ownerFolderName, ownerFolderLabel);

    // Create owner directory if it doesn't exist
    if (!fs.existsSync(ownerDir)) {
      fs.mkdirSync(ownerDir, { recursive: true });
    }

    // Sanitize filename but preserve extension
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const safeName = sanitizeName(baseName) + ext;
    const filePath = path.join(ownerDir, safeName);

    // Overwrite if file already exists (no duplicates)
    let finalPath = filePath;
    let finalSafeName = safeName;
    if (fs.existsSync(finalPath)) {
      // Delete existing file - new upload will replace it
      fs.unlinkSync(finalPath);
      console.log(`📁 Overwriting existing file: ${safeName}`);
    }

    // Extract base64 data and save
    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    fs.writeFileSync(finalPath, Buffer.from(base64Data, 'base64'));

    // Save metadata
    const metadataPath = path.join(ownerDir, '.metadata.json');
    let metadata = {};
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
    metadata[finalSafeName] = {
      originalName: fileName,
      type: fileType,
      size: fileSize,
      uploadDate: new Date().toISOString(),
      ownerId: ownerId,
      ownerName: ownerName || null
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`✅ File saved: ${finalPath}`);
    return { success: true, filePath: finalPath, safeName: finalSafeName };
  } catch (error) {
    console.error('❌ Error saving file:', error);
    return { success: false, error: error.message };
  }
});

// Get all files for an owner
ipcMain.handle('get-files', async (event, { ownerType, ownerId, ownerName }) => {
  try {
    const filesDir = getFilesDir();
    const ownerFolderName = getOwnerFolderName(ownerType);

    // Try to find owner folder by name first, then by ID
    const typeDir = path.join(filesDir, ownerFolderName);
    if (!fs.existsSync(typeDir)) {
      return { success: true, files: [] };
    }

    // Find the owner folder - check both name-based and ID-based folders
    let ownerDir = null;
    const possibleNames = [ownerName ? sanitizeName(ownerName) : null, ownerId].filter(Boolean);

    for (const name of possibleNames) {
      const testDir = path.join(typeDir, name);
      if (fs.existsSync(testDir)) {
        ownerDir = testDir;
        break;
      }
    }

    if (!ownerDir || !fs.existsSync(ownerDir)) {
      return { success: true, files: [] };
    }

    const metadataPath = path.join(ownerDir, '.metadata.json');
    if (!fs.existsSync(metadataPath)) {
      return { success: true, files: [] };
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const files = Object.entries(metadata).map(([safeName, info]) => ({
      safeName,
      name: info.originalName,
      type: info.type,
      size: info.size,
      uploadDate: info.uploadDate,
      path: path.join(ownerDir, safeName),
      isLink: info.isLink || false,
      url: info.url || null
    }));

    return { success: true, files };
  } catch (error) {
    console.error('❌ Error getting files:', error);
    return { success: false, error: error.message, files: [] };
  }
});

// Delete a file - always returns success so UI can clean up even if file is already gone
ipcMain.handle('delete-file', async (event, { ownerType, ownerId, ownerName, safeName }) => {
  try {
    console.log(`📁 ========== DELETE REQUEST ==========`);
    console.log(`📁 ownerType: ${ownerType}`);
    console.log(`📁 ownerId: ${ownerId}`);
    console.log(`📁 ownerName: ${ownerName}`);
    console.log(`📁 safeName: ${safeName}`);

    const filesDir = getFilesDir();
    const ownerFolderName = getOwnerFolderName(ownerType);
    const typeDir = path.join(filesDir, ownerFolderName);

    console.log(`📁 filesDir: ${filesDir}`);
    console.log(`📁 ownerFolderName: ${ownerFolderName}`);
    console.log(`📁 typeDir: ${typeDir}`);
    console.log(`📁 typeDir exists: ${fs.existsSync(typeDir)}`);

    // Find the owner folder - check multiple possible names
    let ownerDir = null;
    const possibleNames = [
      ownerName,                              // Exact name first
      ownerName ? sanitizeName(ownerName) : null,  // Sanitized name
      ownerId                                  // ID as fallback
    ].filter(Boolean);

    console.log(`📁 Checking these folder names: ${JSON.stringify(possibleNames)}`);

    for (const name of possibleNames) {
      const testDir = path.join(typeDir, name);
      console.log(`📁 Testing: ${testDir} - exists: ${fs.existsSync(testDir)}`);
      if (fs.existsSync(testDir)) {
        ownerDir = testDir;
        console.log(`📁 Found ownerDir: ${ownerDir}`);
        break;
      }
    }

    // If folder not found, still return success - file is effectively "deleted" from app's perspective
    if (!ownerDir) {
      console.log(`⚠️ Folder not found, but returning success to clean up UI.`);
      return { success: true };
    }

    const filePath = path.join(ownerDir, safeName);
    const metadataPath = path.join(ownerDir, '.metadata.json');

    console.log(`📁 filePath: ${filePath}`);
    console.log(`📁 filePath exists: ${fs.existsSync(filePath)}`);

    // Delete the file if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ File deleted: ${filePath}`);
    } else {
      console.log(`⚠️ File already gone: ${filePath}`);
    }

    // Update metadata if it exists
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        delete metadata[safeName];
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        console.log(`📁 Metadata updated`);
      } catch (e) {
        console.log(`⚠️ Could not update metadata: ${e.message}`);
      }
    }

    // Check if folder should be cleaned up (empty or only has .metadata.json)
    try {
      const remainingFiles = fs.readdirSync(ownerDir);
      const nonMetaFiles = remainingFiles.filter(f => f !== '.metadata.json');

      if (nonMetaFiles.length === 0) {
        // Folder only has metadata or is empty - delete it
        console.log(`🗑️ Cleaning up empty folder: ${ownerDir}`);

        // Delete .metadata.json if it exists
        if (fs.existsSync(metadataPath)) {
          fs.unlinkSync(metadataPath);
        }

        // Delete _card_info.json if it exists
        const cardInfoPath = path.join(ownerDir, '_card_info.json');
        if (fs.existsSync(cardInfoPath)) {
          fs.unlinkSync(cardInfoPath);
        }

        // Now try to remove the directory
        fs.rmdirSync(ownerDir);
        console.log(`✅ Folder removed: ${ownerDir}`);
      }
    } catch (e) {
      console.log(`⚠️ Could not clean up folder: ${e.message}`);
    }

    console.log(`📁 ========== DELETE SUCCESS ==========`);
    return { success: true };
  } catch (error) {
    // Even on error, return success so UI cleans up
    console.error('⚠️ Delete error (returning success anyway):', error.message);
    console.error(error.stack);
    return { success: true };
  }
});

// Delete entire owner folder (for deleting employees/leads with all their files)
ipcMain.handle('delete-owner-folder', async (event, { ownerType, ownerId, ownerName }) => {
  try {
    console.log(`🗑️ ========== DELETE OWNER FOLDER ==========`);
    console.log(`🗑️ ownerType: ${ownerType}`);
    console.log(`🗑️ ownerId: ${ownerId}`);
    console.log(`🗑️ ownerName: ${ownerName}`);

    const filesDir = getFilesDir();
    const ownerFolderName = getOwnerFolderName(ownerType);
    const typeDir = path.join(filesDir, ownerFolderName);

    if (!fs.existsSync(typeDir)) {
      console.log(`⚠️ Type folder doesn't exist: ${typeDir}`);
      return { success: true };
    }

    // Find the owner folder - check multiple possible names
    let ownerDir = null;
    const possibleNames = [
      ownerName,
      ownerName ? sanitizeName(ownerName) : null,
      ownerId
    ].filter(Boolean);

    for (const name of possibleNames) {
      const testDir = path.join(typeDir, name);
      if (fs.existsSync(testDir)) {
        ownerDir = testDir;
        break;
      }
    }

    if (!ownerDir) {
      console.log(`⚠️ Owner folder not found, already deleted`);
      return { success: true };
    }

    console.log(`🗑️ Deleting folder: ${ownerDir}`);

    // Recursively delete all contents
    const deleteRecursive = (dirPath) => {
      if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
          const curPath = path.join(dirPath, file);
          if (fs.lstatSync(curPath).isDirectory()) {
            deleteRecursive(curPath);
          } else {
            fs.unlinkSync(curPath);
            console.log(`🗑️ Deleted file: ${curPath}`);
          }
        });
        fs.rmdirSync(dirPath);
        console.log(`🗑️ Deleted folder: ${dirPath}`);
      }
    };

    deleteRecursive(ownerDir);

    console.log(`✅ ========== FOLDER DELETED ==========`);
    return { success: true };
  } catch (error) {
    console.error('❌ Delete owner folder error:', error.message);
    return { success: false, error: error.message };
  }
});

// Save a link (as .url file)
ipcMain.handle('save-link', async (event, { ownerType, ownerId, ownerName, linkName, linkUrl }) => {
  try {
    const filesDir = getFilesDir();
    const ownerFolderName = getOwnerFolderName(ownerType);

    // Use owner name for folder if provided, otherwise use ID
    const ownerFolderLabel = ownerName ? sanitizeName(ownerName) : ownerId;
    const ownerDir = path.join(filesDir, ownerFolderName, ownerFolderLabel);

    // Create owner directory if it doesn't exist
    if (!fs.existsSync(ownerDir)) {
      fs.mkdirSync(ownerDir, { recursive: true });
    }

    // Create .url file (Windows Internet Shortcut format)
    const safeName = sanitizeName(linkName) + '.url';
    let finalPath = path.join(ownerDir, safeName);
    let finalSafeName = safeName;
    let counter = 1;
    while (fs.existsSync(finalPath)) {
      finalSafeName = `${sanitizeName(linkName)}_${counter}.url`;
      finalPath = path.join(ownerDir, finalSafeName);
      counter++;
    }

    // Write .url file content
    const urlContent = `[InternetShortcut]\nURL=${linkUrl}\n`;
    fs.writeFileSync(finalPath, urlContent, 'utf8');

    // Save metadata
    const metadataPath = path.join(ownerDir, '.metadata.json');
    let metadata = {};
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
    metadata[finalSafeName] = {
      originalName: linkName,
      type: 'link',
      url: linkUrl,
      uploadDate: new Date().toISOString(),
      ownerId: ownerId,
      ownerName: ownerName || null,
      isLink: true
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`✅ Link saved: ${finalPath}`);
    return { success: true, filePath: finalPath, safeName: finalSafeName };
  } catch (error) {
    console.error('❌ Error saving link:', error);
    return { success: false, error: error.message };
  }
});

// Migrate legacy lowercase folders to new capitalized structure
function migrateLegacyFolders() {
  const filesDir = getFilesDir();
  const migrations = [
    { from: 'client', to: 'Clients' },
    { from: 'employee', to: 'Employees' },
    { from: 'lead', to: 'Leads' },
    { from: 'misc', to: 'Misc' }
  ];

  for (const { from, to } of migrations) {
    const oldDir = path.join(filesDir, from);
    const newDir = path.join(filesDir, to);

    if (fs.existsSync(oldDir)) {
      // Create new directory if it doesn't exist
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }

      // Move all subdirectories from old to new
      try {
        const items = fs.readdirSync(oldDir, { withFileTypes: true });
        for (const item of items) {
          if (item.isDirectory()) {
            const oldPath = path.join(oldDir, item.name);
            const newPath = path.join(newDir, item.name);

            // Only move if destination doesn't exist
            if (!fs.existsSync(newPath)) {
              fs.renameSync(oldPath, newPath);
              console.log(`✅ Migrated: ${oldPath} -> ${newPath}`);
            }
          }
        }

        // Remove old directory if empty
        const remaining = fs.readdirSync(oldDir);
        if (remaining.length === 0) {
          fs.rmdirSync(oldDir);
          console.log(`✅ Removed empty legacy folder: ${oldDir}`);
        }
      } catch (error) {
        console.error(`❌ Error migrating ${from} folder:`, error);
      }
    }
  }

  // Special migration for sheets folder (may have nested "Google Sheets" subfolder with sheet-named subfolders or files)
  const sheetsOldDir = path.join(filesDir, 'sheets');
  const sheetsNewDir = path.join(filesDir, 'Google Sheets');

  if (fs.existsSync(sheetsOldDir)) {
    if (!fs.existsSync(sheetsNewDir)) {
      fs.mkdirSync(sheetsNewDir, { recursive: true });
    }

    try {
      const items = fs.readdirSync(sheetsOldDir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          const subDir = path.join(sheetsOldDir, item.name);

          // If this is named "Google Sheets", it's the old nested structure
          // The actual sheet folders/files are inside it
          if (item.name === 'Google Sheets') {
            const subItems = fs.readdirSync(subDir, { withFileTypes: true });
            const metadataPath = path.join(subDir, '.metadata.json');
            let oldMetadata = {};
            if (fs.existsSync(metadataPath)) {
              oldMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            }

            for (const subItem of subItems) {
              const oldPath = path.join(subDir, subItem.name);

              if (subItem.isDirectory()) {
                // This is already a proper sheet folder, move it directly
                const newPath = path.join(sheetsNewDir, subItem.name);
                if (!fs.existsSync(newPath)) {
                  fs.renameSync(oldPath, newPath);
                  console.log(`✅ Migrated sheet folder: ${oldPath} -> ${newPath}`);
                }
              } else if (subItem.name !== '.metadata.json') {
                // This is a file directly in sheets/Google Sheets/ - needs to go into proper folder
                // Check metadata for ownerName to determine correct folder
                const fileInfo = oldMetadata[subItem.name];
                // If ownerName is "Google Sheets" (the type folder name), use the file's base name instead
                let ownerName = fileInfo?.ownerName;
                if (!ownerName || ownerName === 'Google Sheets') {
                  // Use filename without extension as the sheet title
                  ownerName = path.basename(subItem.name, path.extname(subItem.name)) || 'Misc';
                }
                const targetDir = path.join(sheetsNewDir, sanitizeName(ownerName));

                if (!fs.existsSync(targetDir)) {
                  fs.mkdirSync(targetDir, { recursive: true });
                }

                const newPath = path.join(targetDir, subItem.name);
                if (!fs.existsSync(newPath)) {
                  fs.renameSync(oldPath, newPath);
                  console.log(`✅ Migrated sheet file to ${ownerName}: ${oldPath} -> ${newPath}`);

                  // Update metadata in the new location
                  const newMetadataPath = path.join(targetDir, '.metadata.json');
                  let newMetadata = {};
                  if (fs.existsSync(newMetadataPath)) {
                    newMetadata = JSON.parse(fs.readFileSync(newMetadataPath, 'utf8'));
                  }
                  // Create or update file info with correct ownerName
                  newMetadata[subItem.name] = {
                    ...(fileInfo || {}),
                    originalName: fileInfo?.originalName || subItem.name,
                    ownerName: ownerName, // Use the corrected ownerName
                    uploadDate: fileInfo?.uploadDate || new Date().toISOString()
                  };
                  fs.writeFileSync(newMetadataPath, JSON.stringify(newMetadata, null, 2));
                }
              }
            }

            // Remove the nested "Google Sheets" subfolder if empty (only .metadata.json remaining is fine)
            const remainingSub = fs.readdirSync(subDir).filter(f => f !== '.metadata.json');
            if (remainingSub.length === 0) {
              // Remove metadata file and directory
              if (fs.existsSync(metadataPath)) {
                fs.unlinkSync(metadataPath);
              }
              fs.rmdirSync(subDir);
              console.log(`✅ Removed empty nested Google Sheets folder: ${subDir}`);
            }
          } else {
            // This is a sheet-specific folder directly under sheets/, move it
            const newPath = path.join(sheetsNewDir, item.name);
            if (!fs.existsSync(newPath)) {
              fs.renameSync(subDir, newPath);
              console.log(`✅ Migrated sheets folder: ${subDir} -> ${newPath}`);
            }
          }
        } else {
          // Files directly in sheets/ folder, move them to Google Sheets/Misc/
          const oldPath = path.join(sheetsOldDir, item.name);
          const miscDir = path.join(sheetsNewDir, 'Misc');
          if (!fs.existsSync(miscDir)) {
            fs.mkdirSync(miscDir, { recursive: true });
          }
          const newPath = path.join(miscDir, item.name);
          if (!fs.existsSync(newPath)) {
            fs.renameSync(oldPath, newPath);
            console.log(`✅ Migrated sheets file: ${oldPath} -> ${newPath}`);
          }
        }
      }

      // Remove old sheets directory if empty
      const remaining = fs.readdirSync(sheetsOldDir);
      if (remaining.length === 0) {
        fs.rmdirSync(sheetsOldDir);
        console.log(`✅ Removed empty legacy sheets folder: ${sheetsOldDir}`);
      }
    } catch (error) {
      console.error(`❌ Error migrating sheets folder:`, error);
    }
  }
}

// Migrate card info files to have metadata (for existing cards without .metadata.json)
function migrateCardInfoToMetadata() {
  const filesDir = getFilesDir();
  const folderTypes = {
    'Clients': 'client',
    'Employees': 'employee',
    'Leads': 'lead'
  };

  for (const [folderName, ownerType] of Object.entries(folderTypes)) {
    const typeDir = path.join(filesDir, folderName);
    if (!fs.existsSync(typeDir)) continue;

    try {
      const ownerDirs = fs.readdirSync(typeDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const ownerFolderName of ownerDirs) {
        const ownerDir = path.join(typeDir, ownerFolderName);
        const cardInfoPath = path.join(ownerDir, '_card_info.json');
        const metadataPath = path.join(ownerDir, '.metadata.json');

        let metadata = {};
        if (fs.existsSync(metadataPath)) {
          metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        }

        // Check if there's a _card_info.json file
        if (fs.existsSync(cardInfoPath)) {
          // If card info not in metadata, add it
          if (!metadata['_card_info.json']) {
            const cardInfo = JSON.parse(fs.readFileSync(cardInfoPath, 'utf8'));
            const cardInfoStats = fs.statSync(cardInfoPath);

            metadata['_card_info.json'] = {
              originalName: `${cardInfo.name || ownerFolderName} - Info Card.json`,
              type: 'application/json',
              size: cardInfoStats.size,
              uploadDate: cardInfo.createdAt || new Date().toISOString(),
              ownerId: cardInfo.id || ownerFolderName,
              ownerName: cardInfo.name || ownerFolderName,
              isCardInfo: true
            };

            // Check for profile photo
            const photoExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            for (const ext of photoExtensions) {
              const photoFileName = `_profile_photo.${ext}`;
              const photoPath = path.join(ownerDir, photoFileName);
              if (fs.existsSync(photoPath) && !metadata[photoFileName]) {
                const photoStats = fs.statSync(photoPath);
                metadata[photoFileName] = {
                  originalName: `${cardInfo.name || ownerFolderName} - Profile Photo.${ext}`,
                  type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
                  size: photoStats.size,
                  uploadDate: cardInfo.createdAt || new Date().toISOString(),
                  ownerId: cardInfo.id || ownerFolderName,
                  ownerName: cardInfo.name || ownerFolderName,
                  isProfilePhoto: true
                };
              }
            }

            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
            console.log(`✅ Migrated card info to metadata: ${ownerDir}`);
          }
        } else {
          // No _card_info.json exists - don't auto-create (allows deletion to work properly)
          // Legacy folders without card info will simply not show in the files list
          // Users can recreate card info by editing the info card in the app
        }
      }
    } catch (error) {
      console.error(`❌ Error migrating card info in ${folderName}:`, error);
    }
  }
}

// Get all files from all owners (for Files view)
ipcMain.handle('get-all-files', async () => {
  try {
    const filesDir = getFilesDir();

    // Run migrations first
    migrateLegacyFolders();
    migrateCardInfoToMetadata();

    const allFiles = [];

    // Only look in the proper capitalized folder names
    const folderToType = {
      'Clients': 'client',
      'Employees': 'employee',
      'Leads': 'lead',
      'Google Sheets': 'sheets',
      'QuickBooks': 'quickbooks',
      'Transcriptions': 'transcription',
      'Misc': 'misc'
    };

    for (const [folderName, ownerType] of Object.entries(folderToType)) {
      const typeDir = path.join(filesDir, folderName);
      if (!fs.existsSync(typeDir)) continue;

      const ownerDirs = fs.readdirSync(typeDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const ownerFolderName of ownerDirs) {
        const ownerDir = path.join(typeDir, ownerFolderName);
        const metadataPath = path.join(ownerDir, '.metadata.json');

        if (!fs.existsSync(metadataPath)) continue;

        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

        for (const [safeName, info] of Object.entries(metadata)) {
          allFiles.push({
            safeName,
            name: info.originalName,
            type: info.type,
            size: info.size,
            uploadDate: info.uploadDate,
            ownerType,
            ownerId: info.ownerId || ownerFolderName,
            ownerName: info.ownerName || ownerFolderName,
            path: path.join(ownerDir, safeName)
          });
        }
      }
    }

    // Special handling for audio recordings without metadata
    // filesDir is already set from getFilesDir() which uses user's configured storage path
    const audioRecordingsDir = path.join(filesDir, 'Transcriptions', 'Audio Recordings');
    if (fs.existsSync(audioRecordingsDir)) {
      const audioFiles = fs.readdirSync(audioRecordingsDir)
        .filter(f => f.match(/\.(webm|mp3|wav|m4a)$/i));

      for (const file of audioFiles) {
        const filePath = path.join(audioRecordingsDir, file);
        const stats = fs.statSync(filePath);
        allFiles.push({
          safeName: file,
          name: file,
          type: 'audio',
          size: stats.size,
          uploadDate: stats.mtime.toISOString(),
          ownerType: 'transcription',
          ownerId: 'audio-recordings',
          ownerName: 'Audio Recordings',
          path: filePath
        });
      }
    }

    // Deduplicate files by filename (safeName) to handle same file in different locations
    // Prefer files from Transcriptions/Audio Recordings (added later) over misc/Recordings
    const filesByName = new Map();
    for (const file of allFiles) {
      filesByName.set(file.safeName, file); // Later entries overwrite earlier ones
    }
    const uniqueFiles = Array.from(filesByName.values());

    // Sort by upload date (newest first)
    uniqueFiles.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

    return { success: true, files: uniqueFiles };
  } catch (error) {
    console.error('❌ Error getting all files:', error);
    return { success: false, error: error.message, files: [] };
  }
});

// Open file in default application
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    console.error('❌ Error opening file:', error);
    return { success: false, error: error.message };
  }
});

// Initialize Whisper.cpp for offline transcription
async function initWhisper() {
  try {
    if (fs.existsSync(WHISPER_MODEL_PATH)) {
      whisper = require('@kutalia/whisper-node-addon');
      console.log('✅ Whisper.cpp loaded successfully');
      console.log(`✅ Model path: ${WHISPER_MODEL_PATH}`);
      return true;
    } else {
      console.log('⚠️ Whisper model not found at:', WHISPER_MODEL_PATH);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to load whisper:', error.message);
    return false;
  }
}

// Convert audio to WAV format using ffmpeg (required for whisper)
function convertToWav(inputPath) {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath.replace(/\.[^.]+$/, '_converted.wav');

    // ffmpeg command: convert to 16kHz mono WAV (whisper requirement)
    const args = [
      '-i', inputPath,
      '-ar', '16000',    // 16kHz sample rate
      '-ac', '1',        // mono
      '-c:a', 'pcm_s16le', // 16-bit PCM
      '-y',              // overwrite
      outputPath
    ];

    const ffmpeg = execFile(ffmpegPath, args, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('FFmpeg error:', stderr);
        reject(error);
      } else {
        resolve(outputPath);
      }
    });
  });
}

// Transcribe audio file using whisper.cpp
ipcMain.handle('transcribe-audio-file', async (event, filePath) => {
  try {
    if (!whisper) {
      return { success: false, error: 'Whisper not initialized. Model may be missing.' };
    }

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Audio file not found' };
    }

    console.log('🎤 Starting transcription:', filePath);

    // Convert to WAV if needed (whisper requires WAV format)
    let wavPath = filePath;
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.wav') {
      console.log('🔄 Converting to WAV...');
      try {
        wavPath = await convertToWav(filePath);
        console.log('✅ Converted to:', wavPath);
      } catch (convError) {
        return { success: false, error: `Audio conversion failed: ${convError.message}` };
      }
    }

    // Run whisper transcription
    console.log('🎤 Running whisper transcription...');
    const result = await whisper.transcribe({
      fname_inp: wavPath,
      model: WHISPER_MODEL_PATH,
      language: 'en',
      use_gpu: false  // CPU only as per user preference
    });

    // Clean up converted file if we created one
    if (wavPath !== filePath && fs.existsSync(wavPath)) {
      fs.unlinkSync(wavPath);
    }

    console.log('✅ Transcription complete');
    console.log('📝 Raw result type:', typeof result);
    console.log('📝 Raw result:', JSON.stringify(result, null, 2));

    // Extract text from result
    // API returns: { transcription: [[start_time, end_time, text], ...] }
    // Each segment is an array: ["00:00:00.000", "00:00:06.000", " Actual text here"]
    let text = '';
    try {
      if (result && result.transcription && Array.isArray(result.transcription)) {
        const segments = [];

        for (const segment of result.transcription) {
          if (Array.isArray(segment)) {
            // Each segment is [start_timestamp, end_timestamp, text]
            // The text is typically the 3rd element (index 2)
            const textPart = segment[2];
            if (typeof textPart === 'string') {
              segments.push(textPart.trim());
            }
          } else if (typeof segment === 'string') {
            // In case format changes to just strings
            segments.push(segment.trim());
          }
        }

        text = segments.join(' ');
      } else if (typeof result === 'string') {
        text = result;
      }
    } catch (extractError) {
      console.error('⚠️ Error extracting text:', extractError);
      text = '';
    }

    // Clean up the text
    const finalText = (text || '').toString().trim();
    console.log('📝 Final text:', finalText);

    return { success: true, text: finalText };
  } catch (error) {
    console.error('❌ Transcription error:', error);
    return { success: false, error: error.message };
  }
});

// Get whisper status
ipcMain.handle('get-whisper-status', async () => {
  const modelExists = fs.existsSync(WHISPER_MODEL_PATH);
  return {
    initialized: whisper !== null,
    modelExists,
    modelPath: WHISPER_MODEL_PATH
  };
});

app.whenReady().then(async () => {
  console.log('App is ready');

  // Initialize whisper for transcription
  await initWhisper();

  // Migrate any legacy folder structures on startup
  migrateLegacyFolders();

  startServer(); // Start server automatically

  // Configure webview permissions for LinkedIn
  const { session } = require('electron');

  // Set up LinkedIn session with a desktop user agent
  const linkedinSession = session.fromPartition('persist:linkedin');
  linkedinSession.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Handle permission requests from webviews
  linkedinSession.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('LinkedIn permission request:', permission);
    // Allow common permissions needed for LinkedIn
    const allowedPermissions = ['media', 'geolocation', 'notifications', 'clipboard-read', 'clipboard-sanitized-write'];
    callback(allowedPermissions.includes(permission));
  });

  // Give server 2 seconds to start before opening window
  setTimeout(() => {
    createWindow();
  }, 2000);
});

function killServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

app.on('window-all-closed', () => {
  killServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', killServer);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});