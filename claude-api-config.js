// Claude API Configuration - Secure Version
// API key is stored in .env file and never exposed to the frontend
// All API calls are routed through Electron's secure IPC channel

// Conversation history storage
let conversationHistory = [];
let uploadedFilesContext = [];
const MAX_HISTORY_LENGTH = 20; // Keep last 20 messages to prevent token overflow

// Function to call Claude API securely via Electron IPC
async function callClaudeAPI(userMessage, uploadedFiles = []) {
  if (!window.electronAPI || !window.electronAPI.callClaudeAPI) {
    throw new Error('Electron API not available. Make sure you are running in Electron environment.');
  }

  try {
    console.log('🤖 Sending message to Claude API...');

    // Build context with connected Google Sheets data
    let context = {
      sheets: [],
      files: [],
      emails: [],
      calendarEvents: [],
      conversationHistory: []
    };

    // Add Google Sheets context
    if (window.connectedGoogleSheets && window.connectedGoogleSheets.length > 0) {
      context.sheets = window.connectedGoogleSheets.map(sheet => ({
        id: sheet.id,
        title: sheet.title,
        url: sheet.url,
        data: sheet.data || [] // Include sheet data if available
      }));
      console.log('📊 Including sheet context:', context.sheets.length, 'sheets');
    }

    // Add loaded emails to context
    if (window.loadedEmails && window.loadedEmails.length > 0) {
      context.emails = window.loadedEmails.slice(0, 20).map(email => ({
        id: email.id,
        from: email.from,
        to: email.to,
        subject: email.subject,
        date: email.date,
        snippet: email.snippet,
        body: email.body ? email.body.substring(0, 1500) : null
      }));
      console.log('📧 Including email context:', context.emails.length, 'emails');
    }

    // Add loaded calendar events to context
    if (window.loadedCalendarEvents && window.loadedCalendarEvents.length > 0) {
      context.calendarEvents = window.loadedCalendarEvents.slice(0, 50).map(evt => ({
        id: evt.id,
        title: evt.title || evt.summary,
        start: evt.start,
        end: evt.end,
        description: evt.description,
        location: evt.location
      }));
      console.log('📅 Including calendar context:', context.calendarEvents.length, 'events');
    }

    // Add uploaded files to the context (stored globally)
    if (uploadedFilesContext.length > 0) {
      context.files = uploadedFilesContext;
      console.log('📎 Including uploaded files:', context.files.length, 'files');
    }

    // Add conversation history for context
    context.conversationHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
    console.log('💬 Including conversation history:', context.conversationHistory.length, 'messages');

    const result = await window.electronAPI.callClaudeAPI(userMessage, context);

    if (!result.success) {
      throw new Error(result.error || 'API request failed');
    }

    // Store the conversation in history
    conversationHistory.push({
      role: 'user',
      content: userMessage
    });
    conversationHistory.push({
      role: 'assistant',
      content: result.response
    });

    // Trim history if too long
    if (conversationHistory.length > MAX_HISTORY_LENGTH * 2) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
    }

    console.log('✅ Claude API response received');
    return result.response;

  } catch (error) {
    console.error('❌ Claude API Error:', error);
    throw error;
  }
}

// Function to add uploaded files to context
function addUploadedFile(file) {
  uploadedFilesContext.push(file);
  console.log('📎 File added to context:', file.name);
}

// Function to clear uploaded files
function clearUploadedFiles() {
  uploadedFilesContext = [];
  console.log('🗑️ Uploaded files context cleared');
}

// Function to clear conversation history
function clearConversationHistory() {
  conversationHistory = [];
  uploadedFilesContext = [];
  console.log('🗑️ Conversation history and files cleared');
}

// Helper function to check if API is configured
async function isAPIConfigured() {
  try {
    const result = await window.electronAPI.callClaudeAPI('test');
    return result.success;
  } catch {
    return false;
  }
}

// Get current conversation history
function getConversationHistory() {
  return conversationHistory;
}

// Get uploaded files
function getUploadedFiles() {
  return uploadedFilesContext;
}

// Export for use in dashboard
window.ClaudeAPI = {
  call: callClaudeAPI,
  isConfigured: isAPIConfigured,
  addFile: addUploadedFile,
  clearFiles: clearUploadedFiles,
  clearHistory: clearConversationHistory,
  getHistory: getConversationHistory,
  getFiles: getUploadedFiles,
  // Config is now in .env file and main process - not exposed to renderer
  secure: true
};
