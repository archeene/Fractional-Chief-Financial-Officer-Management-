# THE HULL - Architecture Guide

## Current Architecture (What's Built)

```
┌─────────────────────────────────────────────────────────────┐
│                      ELECTRON APP                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  FRONTEND (Browser)                     │ │
│  │                                                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │  Dashboard   │  │   Calendar   │  │   World Map  │ │ │
│  │  │    View      │  │     View     │  │     View     │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  │                                                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │  Files View  │  │  Client HUD  │  │Client Sidebar│ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  │                                                         │ │
│  │  JavaScript: dashboard.js                              │ │
│  │  Styling: dashboard.css (retro theme)                  │ │
│  │  Calendar: FullCalendar library                        │ │
│  │  Storage: localStorage                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              ELECTRON MAIN PROCESS                      │ │
│  │                                                         │ │
│  │  • Window management (main.js)                         │ │
│  │  • IPC handlers for calendar sync                      │ │
│  │  • OAuth client initialization                         │ │
│  │  • Server process spawning                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               EXPRESS SERVER (server.js)                     │
│                   Port: 3001                                 │
│                                                              │
│  • Google OAuth flow (/auth, /oauth2callback)               │
│  • Calendar proxy (/calendar/:id)                           │
│  • Outlook iCal fetcher (/outlook-calendar)                 │
│  • Token storage (token.json)                               │
└─────────────────────────────────────────────────────────────┘
                         ↓
                    ┌────────┐
                    │ Google │
                    │Calendar│
                    │  API   │
                    └────────┘
```

## Data Flow

### Current Implementation

```
User Action → UI Component → localStorage → Re-render
                                  ↓
                          (Persistent Storage)

Google Calendar Import:
User → Dashboard → Server → Google API → Server → Calendar UI → localStorage
```

### Client Management
```
Add Client → Form → localStorage.setItem('cfo_clients') → Sidebar Update
Click Client → Load from localStorage → Open HUD → Display Data
```

### Calendar Events
```
Create Event → Modal → FullCalendar API → localStorage.setItem('calendar_events')
Import Google → Server Proxy → Google API → FullCalendar → localStorage
Import Outlook → Server Fetch iCal → Parse → FullCalendar → localStorage
```

## Future Architecture (To Be Implemented)

```
┌──────────────────────────────────────────────────────────────────┐
│                        ELECTRON APP                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     FRONTEND                                │  │
│  │                                                             │  │
│  │  [Same UI components as current]                           │  │
│  │                                                             │  │
│  │  NEW: AI Assistant Panel                                   │  │
│  │  NEW: QuickBooks Widget                                    │  │
│  │  NEW: Email Integration                                    │  │
│  │  NEW: Video Call Buttons                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              ELECTRON MAIN PROCESS                          │  │
│  │                                                             │  │
│  │  • IPC handlers for all APIs                               │  │
│  │  • Database connection (SQLite/PostgreSQL)                 │  │
│  │  • File system access                                      │  │
│  │  • Secure credential storage                               │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVICES                             │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Express    │  │   Database   │  │     File     │          │
│  │   Server     │  │   Layer      │  │   Storage    │          │
│  │ (OAuth/API)  │  │(SQLite/PG)   │  │   Service    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Claude     │  │  QuickBooks  │  │    Email     │          │
│  │     API      │  │     API      │  │   Service    │          │
│  │  Integration │  │  Integration │  │  (IMAP/SMTP) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                     EXTERNAL APIS                                 │
│                                                                   │
│  Google Calendar  |  Outlook  |  Claude AI  |  QuickBooks        │
│  Google Drive     |  OneDrive |  Dropbox    |  Zoom/Teams        │
└──────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Vanilla JavaScript (ES6+)
- **UI Library**: None (custom retro components)
- **Calendar**: FullCalendar v6
- **CSS**: Custom retro theme with CRT effects
- **Fonts**: Press Start 2P, VT323 (Google Fonts)

### Backend (Current)
- **Runtime**: Node.js
- **Framework**: Express.js
- **APIs**: googleapis (Google Calendar)
- **Storage**: localStorage (browser)
- **Auth**: OAuth 2.0 (Google)

### Desktop
- **Framework**: Electron v39
- **Process Model**: Main + Renderer (context isolation enabled)
- **IPC**: Electron IPC for main-renderer communication
- **Security**: CSP headers, context isolation, no nodeIntegration

### Future Stack Additions

#### Database
```javascript
// Option 1: SQLite (Local-first)
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./data/cfo.db');

// Option 2: PostgreSQL (Cloud-ready)
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

#### Claude AI Integration
```javascript
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY
});

async function generateMorningBriefing(data) {
  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Generate a CFO morning briefing based on: ${JSON.stringify(data)}`
    }]
  });
  return message.content;
}
```

#### QuickBooks Integration
```javascript
const OAuthClient = require('intuit-oauth');
const oauthClient = new OAuthClient({
  clientId: process.env.QB_CLIENT_ID,
  clientSecret: process.env.QB_CLIENT_SECRET,
  environment: 'production',
  redirectUri: 'http://localhost:3001/callback'
});

async function getCompanyInfo(realmId) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`;
  const response = await oauthClient.makeApiCall({ url });
  return response.json();
}
```

#### File Storage
```javascript
// Local files
const fs = require('fs').promises;
const path = require('path');

// Cloud storage
const { google } = require('googleapis');
const drive = google.drive('v3');

// Dropbox
const { Dropbox } = require('dropbox');
const dbx = new Dropbox({ accessToken: token });
```

## Security Architecture

### Current
```
┌─────────────────────────────────────────┐
│       Credential Storage                 │
│                                          │
│  token.json (git-ignored)               │
│  oauth-credentials.json (git-ignored)   │
│  localStorage (browser)                 │
└─────────────────────────────────────────┘
```

### Future (Recommended)
```
┌─────────────────────────────────────────┐
│       Credential Storage                 │
│                                          │
│  Electron: safeStorage API              │
│  Encrypted database fields              │
│  Environment variables (.env)           │
│  OS keychain integration                │
└─────────────────────────────────────────┘
```

### Security Best Practices

1. **Token Storage**
```javascript
// Use Electron's safeStorage
const { safeStorage } = require('electron');

// Encrypt before storing
const encrypted = safeStorage.encryptString(JSON.stringify(token));
fs.writeFileSync('token.encrypted', encrypted);

// Decrypt when needed
const decrypted = safeStorage.decryptString(encrypted);
const token = JSON.parse(decrypted);
```

2. **CSP Headers** (Already implemented)
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' https://trusted.com">
```

3. **Context Isolation** (Already enabled)
```javascript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, 'preload.js')
}
```

## Database Schema (Future)

### Tables

```sql
-- Clients
CREATE TABLE clients (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  color VARCHAR(7),
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calendar Events
CREATE TABLE calendar_events (
  id VARCHAR(100) PRIMARY KEY,
  client_id VARCHAR(50),
  title VARCHAR(255),
  description TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  calendar_source VARCHAR(50), -- 'google', 'outlook', 'manual'
  external_id VARCHAR(100),
  color VARCHAR(7),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Files
CREATE TABLE files (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(50),
  filename VARCHAR(255),
  file_path TEXT,
  file_type VARCHAR(50),
  file_size BIGINT,
  storage_location VARCHAR(50), -- 'local', 'gdrive', 'dropbox'
  external_id VARCHAR(100),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Financial Data (QuickBooks sync)
CREATE TABLE financial_data (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(50),
  data_type VARCHAR(50), -- 'revenue', 'expenses', 'cashflow'
  amount DECIMAL(15, 2),
  period_start DATE,
  period_end DATE,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Activity Log
CREATE TABLE activity_log (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(50),
  action_type VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- API Credentials (encrypted)
CREATE TABLE api_credentials (
  id SERIAL PRIMARY KEY,
  service VARCHAR(50), -- 'google', 'quickbooks', 'claude'
  encrypted_token TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Integration Patterns

### 1. Google Calendar (Implemented)
```javascript
// Current flow
User → Dashboard → Express Server → Google OAuth → Token → Google Calendar API

// Data sync
setInterval(async () => {
  const events = await fetchGoogleCalendarEvents(calendarId);
  updateLocalStorage(events);
  refreshUI();
}, 10 * 60 * 1000); // Every 10 minutes
```

### 2. QuickBooks (To Implement)
```javascript
// OAuth flow
User clicks "Connect QuickBooks" → OAuth → Token → Store encrypted

// Data sync
async function syncQuickBooksData(clientId, realmId) {
  const [revenue, expenses, cashflow] = await Promise.all([
    qb.getRevenue(realmId),
    qb.getExpenses(realmId),
    qb.getCashFlow(realmId)
  ]);

  await db.upsertFinancialData(clientId, { revenue, expenses, cashflow });
}
```

### 3. Claude AI (To Implement)
```javascript
// Morning briefing generation
async function generateBriefing() {
  const data = {
    clients: await db.getAllClients(),
    todaysEvents: await db.getTodaysEvents(),
    financialAlerts: await db.getFinancialAlerts(),
    recentActivity: await db.getRecentActivity()
  };

  const briefing = await claudeAPI.generateBriefing(data);
  displayBriefing(briefing);
}

// Email drafting
async function draftEmail(clientId, context) {
  const clientData = await db.getClientData(clientId);
  const draft = await claudeAPI.draftEmail({
    client: clientData,
    context: context
  });
  return draft;
}
```

### 4. File Storage (To Implement)
```javascript
// Multi-storage abstraction
class FileStorageService {
  constructor() {
    this.providers = {
      local: new LocalFileStorage(),
      gdrive: new GoogleDriveStorage(),
      dropbox: new DropboxStorage()
    };
  }

  async getClientFiles(clientId) {
    const files = await db.getClientFiles(clientId);
    return Promise.all(
      files.map(f => this.providers[f.storage_location].getFile(f.external_id))
    );
  }
}
```

## Performance Considerations

### Current
- **Memory**: ~50MB (Electron + Chromium)
- **Startup**: <2 seconds
- **Storage**: localStorage (5-10MB limit)
- **Rendering**: 60fps (hardware accelerated)

### Optimization Strategies

1. **Virtual Scrolling**
```javascript
// For large client lists
import { VirtualScroller } from 'virtual-scroller';
const scroller = new VirtualScroller(clientList, {
  itemHeight: 80,
  bufferSize: 5
});
```

2. **Lazy Loading**
```javascript
// Load calendar events only when needed
const calendarView = document.getElementById('calendar-view');
const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !calendarsInitialized) {
    initializeCalendars();
  }
});
observer.observe(calendarView);
```

3. **Debouncing**
```javascript
// File search
const debouncedSearch = debounce((term) => {
  searchFiles(term);
}, 300);
fileSearchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});
```

4. **Caching**
```javascript
// Cache frequently accessed data
const cache = new Map();
async function getClientData(clientId) {
  if (cache.has(clientId)) {
    return cache.get(clientId);
  }
  const data = await db.getClient(clientId);
  cache.set(clientId, data);
  return data;
}
```

## Deployment

### Current (Development)
```bash
npm start  # Runs Electron locally
```

### Production Build
```bash
npm run build-win   # Windows installer
npm run build-mac   # macOS DMG
npm run build-linux # Linux AppImage
```

### Future: Auto-Update
```javascript
// electron-updater
const { autoUpdater } = require('electron-updater');
autoUpdater.checkForUpdatesAndNotify();
```

## Scalability Path

### Phase 1: Current (Local-first)
- localStorage
- Single user
- No database

### Phase 2: Local Database
- SQLite
- Better performance
- Structured queries
- Still single user

### Phase 3: Cloud Sync
- PostgreSQL
- Multi-device sync
- Backup/restore
- Still single user

### Phase 4: Multi-tenant
- User accounts
- Team features
- Role-based access
- Cloud-hosted option

## Summary

**Currently Built**: Functional UI with retro theme, client management, multi-calendar, world map, file browser

**Next Priority**: Claude AI integration for morning briefings

**Architecture**: Local-first Electron app with Express server for OAuth, easily extensible to cloud services

**Tech Debt**: None yet - clean foundation to build on

**Security**: Good basics (CSP, context isolation), needs improvement for production (encrypted storage)
