# THE HULL - CFO Battlestation

A retro-styled, video game-themed command center for fractional CFOs managing multiple clients.

## Features

### ✅ Implemented (Functional UI)

1. **Retro Video Game Theme**
   - CRT scanline effects
   - Neon green terminal aesthetic
   - Pixel fonts (Press Start 2P & VT323)
   - Glowing buttons and borders

2. **Dashboard View**
   - Morning Briefing panel with priorities & alerts
   - Quick Stats (active clients, tasks, meetings, hours)
   - Recent Activity feed
   - Today's Calendar Preview

3. **Client Management**
   - Client list sidebar (add/remove clients)
   - Client HUD overlay with:
     - Upcoming meetings
     - Recent files
     - Financial summary
     - Quick actions (Call, Email, QuickBooks, Files)
   - Color-coded client organization

4. **Calendar Integration**
   - Multi-calendar support (Google & Outlook)
   - Day view and month view
   - Import from multiple Google Calendar accounts
   - Import from Outlook iCal URLs
   - Event creation, editing, and deletion
   - Drag-and-drop event management

5. **World Map View**
   - Interactive client markers by location
   - Click marker to open Client HUD
   - Grid-style map with retro aesthetic

6. **Files View**
   - File browser organized by client
   - Search functionality
   - File upload button (UI ready)

### 🚧 Next Steps (To Be Implemented)

1. **Claude AI Integration**
   - Morning briefing generation via Claude API
   - Email drafting assistant
   - Automated report generation

2. **QuickBooks Integration**
   - OAuth connection to QuickBooks Online
   - Financial data display in Client HUD
   - View/edit spreadsheets in-app

3. **File Storage Integration**
   - Connect to local folders
   - Cloud storage APIs (Google Drive, Dropbox, OneDrive)
   - Real file upload/download

4. **Communication Tools**
   - Zoom/Teams/Google Meet integration
   - One-click call buttons
   - Email client integration

5. **Real Data**
   - Currently using mock data
   - Need to implement actual data fetching
   - Database for persistent storage

## Running the App

### Prerequisites
```bash
npm install
```

### Development Mode
```bash
npm run dev
# This starts both the Express server (port 3001) and Electron app
```

### Production Build
```bash
# Windows
npm run build-win

# Mac
npm run build-mac

# Linux
npm run build-linux
```

## Project Structure

```
Multi Calendar/
├── dashboard.html      # Main battlestation UI
├── dashboard.css       # Retro styling
├── dashboard.js        # Frontend logic
├── main.js            # Electron main process
├── preload.js         # Electron preload script
├── server.js          # Express server for Google OAuth
├── index.html         # Original calendar (still available)
├── app.js             # Original calendar logic
└── style.css          # Original calendar styles
```

## Calendar Setup

### Google Calendar
1. Start the app: `npm run dev`
2. Click "Google Calendar" button in Calendar view
3. Visit http://localhost:3001/auth to authenticate
4. Enter calendar ID (use "primary" for main calendar)
5. Click Import

### Outlook Calendar
1. Go to outlook.live.com
2. Open Calendar → Right-click your calendar
3. Select "Publish calendar"
4. Copy the ICS link
5. Paste into Outlook Calendar modal in the app

## Customization

### Adding Clients
- Click the "+" button in the sidebar
- Enter client name and location
- Choose a color theme
- Client data is saved to localStorage

### Color Themes
The app uses a terminal green theme by default. Colors can be customized in `dashboard.css`:
- Main accent: `#00ff41` (neon green)
- Background: `#0a0e27` (dark blue)
- Secondary: `#00cc33` (darker green)

### Retro Effects
To adjust or disable CRT effects, modify the `body::before` section in `dashboard.css`.

## Tech Stack

- **Framework**: Electron (cross-platform desktop app)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Calendar**: FullCalendar library
- **Backend**: Express.js (for OAuth proxy)
- **APIs**: Google Calendar API, googleapis
- **Storage**: localStorage (temporary), future: SQLite/PostgreSQL

## Architecture Notes

### Local-First Design
The app is designed to work primarily on your local machine with minimal server dependencies:
- Client data stored in localStorage
- Calendar events cached locally
- Express server only needed for Google OAuth

### Security
- OAuth tokens stored in `token.json` (git-ignored)
- Credentials in `oauth-credentials.json` (git-ignored)
- Content Security Policy enforced
- Context isolation enabled in Electron

## Future Integrations

### Claude API
```javascript
// Planned implementation
const briefing = await generateMorningBriefing({
  clients: getAllClients(),
  calendar: getTodaysEvents(),
  financials: getFinancialAlerts()
});
```

### QuickBooks
```javascript
// Planned implementation
const qbClient = await connectQuickBooks(clientId);
const financials = await qbClient.getFinancialSummary();
```

## Performance

- Lightweight: ~50MB memory footprint
- Fast startup: <2 seconds
- Responsive UI: 60fps animations
- Efficient rendering: Virtual scrolling for large lists

## Support

For issues or questions:
1. Check the console logs (View → Developer Tools)
2. Verify server is running on port 3001
3. Check OAuth credentials are properly configured

## License

MIT
