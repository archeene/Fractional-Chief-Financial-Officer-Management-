# THE HULL - Quick Start Guide

## 🚀 Getting Started (5 Minutes)

### Step 1: Install Dependencies
```bash
cd "Multi Calendar"
npm install
```

### Step 2: Start the App
```bash
npm start
```

The app will open with THE HULL dashboard!

## 🎮 What You'll See

### Main Dashboard
- **Top Navigation**: Switch between Dashboard, Calendar, World Map, and Files
- **Left Sidebar**: Your active clients (5 sample clients pre-loaded)
- **Clock**: Real-time retro digital clock
- **Morning Briefing**: Daily priorities and alerts
- **Quick Stats**: Client count, tasks, meetings, hours
- **Recent Activity**: Timeline of your actions
- **Today's Schedule**: Calendar preview

### Navigation

**Dashboard View** (Default)
- Morning briefing panel
- Quick statistics
- Recent activity feed
- Today's calendar preview

**Calendar View**
- Day view (left): 24-hour timeline
- Month view (right): Full month grid
- Import calendars: Click "Google Calendar" or "Outlook Calendar"

**World Map View**
- See client locations on a retro grid map
- Click markers to open Client HUD

**Files View**
- Browse files organized by client
- Search functionality
- Upload button (UI ready)

## 🎯 Try These Features

### 1. Add a New Client
1. Click the **+** button in the sidebar
2. Enter client name and location
3. Pick a color theme
4. Click "Add Client"
5. Your new client appears in the sidebar!

### 2. View Client Details
1. Click any client in the sidebar
2. A retro HUD overlay opens with:
   - Upcoming meetings
   - Recent files
   - Financial summary
   - Quick action buttons

### 3. Import Google Calendar
1. Switch to **Calendar View**
2. Click **"Google Calendar"** button
3. Follow the instructions:
   - Start server: `npm run dev` (if not already running)
   - Visit http://localhost:3001/auth
   - Authorize with Google
   - Enter calendar ID (use "primary")
4. Click **Import**
5. Events appear in both calendars!

### 4. Create a Calendar Event
1. In Calendar view
2. Click and drag on the Day calendar (left side)
3. Fill in event details
4. Pick a color
5. Click **Save**
6. Event appears in both calendars!

### 5. Explore the World Map
1. Switch to **World Map View**
2. Click on any client marker (📍)
3. Client HUD opens with full details

## 🎨 Retro Theme Features

- **CRT Scanlines**: Notice the subtle screen effect
- **Neon Green**: Classic terminal colors
- **Pixel Fonts**: Press Start 2P for headers, VT323 for text
- **Glowing Effects**: Hover over buttons to see glow
- **Pulsing Markers**: Watch the location pins pulse
- **Hover Animations**: Everything responds to interaction

## ⚙️ Keyboard Shortcuts

None yet! But you can:
- **Click** clients to open HUD
- **Drag** events in calendar
- **Type** to search files
- **Hover** to see effects

## 📊 Sample Data

The app comes with:
- **5 Pre-loaded Clients**: TechCorp, GlobalTrade, StartupXYZ, FinanceHub, InnovateAI
- **Sample Files**: Organized by client
- **Mock Financial Data**: In client HUD
- **Placeholder Activity**: Recent actions

All data is stored in **localStorage** - it persists between sessions!

## 🔧 Customization

### Change Colors
Edit `dashboard.css`:
```css
/* Line 4-8: Main colors */
color: #00ff41;  /* Neon green */
background: #0a0e27;  /* Dark blue */
```

### Disable CRT Effect
Comment out in `dashboard.css`:
```css
/* body::before {
  ... CRT effect code ...
} */
```

### Add More Clients
Use the + button or directly edit localStorage:
```javascript
// In browser DevTools console
localStorage.setItem('cfo_clients', JSON.stringify([
  { id: 'client1', name: 'Client 1', location: 'City, Country', color: '#00ff41', status: 'Active' }
]));
```

## 🚨 Troubleshooting

### App Won't Start
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
npm start
```

### Calendar Import Fails
1. Make sure server is running: `npm run dev`
2. Visit http://localhost:3001/auth
3. Complete Google authorization
4. Try again

### Nothing Appears
1. Check browser console (View → Developer Tools)
2. Clear localStorage and refresh
3. Restart the app

### Server Port 3001 In Use
```bash
# Kill the process using port 3001
# Windows:
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:3001 | xargs kill -9
```

## 📝 What's Next?

### Coming Soon
- [ ] Claude AI morning briefings
- [ ] QuickBooks integration
- [ ] Real file storage connections
- [ ] Email integration
- [ ] Video call buttons (Zoom/Teams)
- [ ] Database backend
- [ ] Multi-user support

### You Can Add Now
- More clients via the UI
- Calendar events
- Import multiple Google calendars
- Import Outlook calendars
- Customize colors and theme

## 🎉 That's It!

You now have a functional CFO battlestation with:
- ✅ Retro video game aesthetic
- ✅ Client management
- ✅ Multi-calendar support
- ✅ World map view
- ✅ File browser
- ✅ Dashboard widgets

**Start adding your real clients and calendars!**

## 📖 Need More Help?

- Full documentation: `README_DASHBOARD.md`
- Original calendar docs: Check the Git folder
- Report issues: Create a GitHub issue
- Questions: Check the code comments

Enjoy your new battlestation! ⚡🎮
