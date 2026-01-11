document.addEventListener('DOMContentLoaded', function () {
  console.log('electronAPI available:', !!window.electronAPI);
  console.log('electronAPI object:', window.electronAPI);
  const STORAGE_KEY = 'calendar_events';
  const GOOGLE_SETTINGS_KEY = 'google_calendar_settings';
  const GOOGLE_CALENDARS_KEY = 'google_calendars';
  const OUTLOOK_SETTINGS_KEY = 'outlook_settings';
  const OUTLOOK_COLOR_PALETTE = ['#28a745', '#dc3545', '#ffc107', '#6f42c1', '#fd7e14'];
  const GOOGLE_COLOR_PALETTE = ['#6f42c1', '#3788d8', '#28a745', '#dc3545', '#ffc107', '#fd7e14', '#17a2b8', '#6610f2'];

  // Load events from localStorage
  function loadEvents() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored events:', e);
        return [];
      }
    }
    return [];
  }

  // Save events to localStorage
  function saveEvents() {
    const events = dayCalendar.getEvents().map(event => ({
      id: event.id,
      title: event.title,
      start: event.start.toISOString(),
      end: event.end ? event.end.toISOString() : null,
      allDay: event.allDay,
      color: event.backgroundColor || event.extendedProps?.color || '#3788d8',
      extendedProps: event.extendedProps
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }

  // Generate unique ID
  function generateId() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Show toast notification
  function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Format date for datetime-local input
  function formatDateTimeLocal(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // Track selected day
  let selectedDate = new Date();
  let selectedColor = '#3788d8';
  let editingEventId = null;

  // Initialize events from storage
  const events = loadEvents();

  // Day Calendar (left side - 24 hour view)
  const dayCalendar = new FullCalendar.Calendar(document.getElementById('dayCalendar'), {
    initialView: 'timeGridDay',
    initialDate: new Date(),
    headerToolbar: {
      left: 'title',
      center: '',
      right: ''
    },
    height: '100%',
    events: events,
    firstDay: 0,
    nowIndicator: true,
    slotMinTime: '00:00:00',
    slotMaxTime: '24:00:00',
    slotDuration: '00:30:00',
    snapDuration: '00:15:00',
    selectable: true,
    selectMirror: true,
    editable: true,
    eventResizableFromStart: true,
    // Create event by selecting time range
    select: function (info) {
      openEventModal(null, info.start, info.end);
      dayCalendar.unselect();
    },
    // Edit existing event
    eventClick: function (info) {
      openEventModal(info.event);
    },
    // Auto-save on drag/resize
    eventDrop: function (info) {
      saveEvents();
      showToast('Event updated');
    },
    eventResize: function (info) {
      saveEvents();
      showToast('Event updated');
    }
  });

  // Month Calendar (right side)
  const monthCalendar = new FullCalendar.Calendar(document.getElementById('monthCalendar'), {
    initialView: 'dayGridMonth',
    initialDate: new Date(),
    headerToolbar: {
      left: 'prev',
      center: 'title',
      right: 'next'
    },
    height: '100%',
    events: events,
    firstDay: 0,
    dayMaxEvents: 3,
    fixedWeekCount: false,
    // Click to select day and navigate day view
    dateClick: function (info) {
      // Remove previous selection
      document.querySelectorAll('.fc-day-selected').forEach(el => {
        el.classList.remove('fc-day-selected');
      });
      // Add selection to clicked day
      info.dayEl.classList.add('fc-day-selected');
      // Navigate day calendar to selected date
      selectedDate = info.date;
      dayCalendar.gotoDate(info.date);
    },
    // Show event details on click
    eventClick: function (info) {
      openEventModal(info.event);
    }
  });

  // Render calendars
  dayCalendar.render();
  monthCalendar.render();

  // Force initial sizing recalculation (fixes flex height bug in v6)
  dayCalendar.updateSize();
  monthCalendar.updateSize();

  // Keep sizing correct on window resize
  window.addEventListener('resize', () => {
    dayCalendar.updateSize();
    monthCalendar.updateSize();
  });

  setTimeout(() => {
    dayCalendar.updateSize();
    monthCalendar.updateSize();
  }, 100);

  // Sync events between calendars
  function syncCalendars() {
    const dayEvents = dayCalendar.getEvents();
    // Clear month calendar events and re-add
    monthCalendar.getEvents().forEach(e => e.remove());
    dayEvents.forEach(event => {
      monthCalendar.addEvent({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        color: event.backgroundColor,
        extendedProps: event.extendedProps
      });
    });
  }

  // Update day calendar title when navigating months
  monthCalendar.on('datesSet', function (info) {
    // Keep day view in sync with visible month
    const monthStart = info.view.currentStart;
    const dayDate = dayCalendar.getDate();
    // If day view is outside visible month, move it
    if (dayDate < monthStart || dayDate >= info.view.currentEnd) {
      dayCalendar.gotoDate(monthStart);
    }
  });

  // Modal handling
  const eventModal = document.getElementById('eventModal');
  const googleModal = document.getElementById('googleModal');
  const outlookModal = document.getElementById('outlookModal');
  const eventTitleInput = document.getElementById('eventTitle');
  const eventStartInput = document.getElementById('eventStart');
  const eventEndInput = document.getElementById('eventEnd');
  const saveEventBtn = document.getElementById('saveEvent');
  const deleteEventBtn = document.getElementById('deleteEvent');
  const colorBtns = document.querySelectorAll('.color-btn');

  // Color selection
  colorBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      colorBtns.forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
      selectedColor = this.dataset.color;
    });
  });

  // Set default color selection
  if (colorBtns.length > 0) colorBtns[0].classList.add('selected');

  function openEventModal(event, startDate, endDate) {
    editingEventId = event ? event.id : null;
    document.getElementById('modalTitle').textContent = event ? 'Edit Event' : 'New Event';
    deleteEventBtn.style.display = event ? 'block' : 'none';

    if (event) {
      eventTitleInput.value = event.title;
      eventStartInput.value = formatDateTimeLocal(event.start);
      eventEndInput.value = event.end ? formatDateTimeLocal(event.end) : formatDateTimeLocal(new Date(event.start.getTime() + 3600000));
      const eventColor = event.backgroundColor || event.extendedProps?.color || '#3788d8';
      colorBtns.forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.color === eventColor);
      });
      selectedColor = eventColor;
    } else {
      eventTitleInput.value = '';
      eventStartInput.value = formatDateTimeLocal(startDate || new Date());
      if (endDate) {
        eventEndInput.value = formatDateTimeLocal(endDate);
      } else {
        const defaultEnd = new Date((startDate || new Date()).getTime() + 3600000);
        eventEndInput.value = formatDateTimeLocal(defaultEnd);
      }
      colorBtns.forEach(b => b.classList.remove('selected'));
      if (colorBtns.length > 0) colorBtns[0].classList.add('selected');
      selectedColor = '#3788d8';
    }

    eventModal.classList.add('active');
    setTimeout(() => eventTitleInput.focus(), 100);
  }

  function closeEventModal() {
    eventModal.classList.remove('active');
    editingEventId = null;
  }

  // Save event
  saveEventBtn.addEventListener('click', function () {
    const title = eventTitleInput.value.trim();
    if (!title) {
      eventTitleInput.focus();
      return;
    }

    const start = new Date(eventStartInput.value);
    const end = new Date(eventEndInput.value);

    if (end <= start) {
      showToast('End time must be after start time', 'error');
      return;
    }

    if (editingEventId) {
      // Update existing event
      const event = dayCalendar.getEventById(editingEventId);
      if (event) {
        event.setProp('title', title);
        event.setStart(start);
        event.setEnd(end);

        // Check if this is an imported calendar event
        const googleCalendarId = event.extendedProps?.googleCalendarId;
        if (googleCalendarId) {
          // Update all events from this calendar
          dayCalendar.getEvents()
            .filter(e => e.extendedProps?.googleCalendarId === googleCalendarId)
            .forEach(e => {
              e.setProp('backgroundColor', selectedColor);
              e.setProp('borderColor', selectedColor);
              e.setExtendedProp('color', selectedColor);
            });

          // Update the calendar color in storage
          const calIndex = addedCalendars.findIndex(c => c.id === googleCalendarId);
          if (calIndex !== -1) {
            addedCalendars[calIndex].color = selectedColor;
            localStorage.setItem(GOOGLE_CALENDARS_KEY, JSON.stringify(addedCalendars));
          }

          showToast(`Updated color for all events in calendar`);
        } else {
          // Single event color update
          event.setProp('backgroundColor', selectedColor);
          event.setProp('borderColor', selectedColor);
        }
      }
    } else {
      // Create new event
      const newEvent = {
        id: generateId(),
        title: title,
        start: start,
        end: end,
        color: selectedColor,
        extendedProps: {
          color: selectedColor
        }
      };
      dayCalendar.addEvent(newEvent);
    }

    syncCalendars();
    saveEvents();
    closeEventModal();
    showToast(editingEventId ? 'Event updated' : 'Event created');
  });

  // Delete event
  deleteEventBtn.addEventListener('click', function () {
    if (editingEventId) {
      const event = dayCalendar.getEventById(editingEventId);
      if (event) {
        event.remove();
        syncCalendars();
        saveEvents();
        showToast('Event deleted');
      }
    }
    closeEventModal();
  });

  // Close modal handlers
  document.getElementById('closeModal').addEventListener('click', closeEventModal);
  document.getElementById('closeGoogleModal').addEventListener('click', () => {
    googleModal.classList.remove('active');
  });
  document.getElementById('closeOutlookModal').addEventListener('click', () => {
    outlookModal.classList.remove('active');
  });

  // Close on backdrop click
  eventModal.addEventListener('click', function (e) {
    if (e.target === eventModal) closeEventModal();
  });
  googleModal.addEventListener('click', function (e) {
    if (e.target === googleModal) googleModal.classList.remove('active');
  });
  outlookModal.addEventListener('click', function (e) {
    if (e.target === outlookModal) outlookModal.classList.remove('active');
  });

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeEventModal();
      googleModal.classList.remove('active');
      outlookModal.classList.remove('active');
    }
  });

  // Google Calendar Import via Electron Main Process
  const PROXY_SERVER = 'http://localhost:3001';
  const addCalendarBtn = document.getElementById('addCalendarBtn');
  const calendarIdInput = document.getElementById('calendarId');
  const importBtn = document.getElementById('importCalendar');
  const addedCalendarsList = document.getElementById('addedCalendarsList');
  let addedCalendars = [];

  // Load saved Google settings
  const savedSettings = localStorage.getItem(GOOGLE_SETTINGS_KEY);
  if (savedSettings) {
    try {
      const settings = JSON.parse(savedSettings);
      calendarIdInput.value = settings.calendarId || '';
    } catch (e) {
      console.error('Failed to load Google settings:', e);
    }
  }

  // Load added calendars
  const savedCalendars = localStorage.getItem(GOOGLE_CALENDARS_KEY);
  if (savedCalendars) {
    try {
      addedCalendars = JSON.parse(savedCalendars);
    } catch (e) {
      console.error('Failed to load added calendars:', e);
    }
  }

  function refreshAddedList() {
    addedCalendarsList.innerHTML = '';
    if (addedCalendars.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No calendars added';
      li.style.color = '#5a7a9a';
      li.style.padding = '8px 0';
      addedCalendarsList.appendChild(li);
      return;
    }

    addedCalendars.forEach(cal => {
      const li = document.createElement('li');
      li.style.padding = '8px 0';
      li.style.borderBottom = '1px solid #1e3a5f';
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.alignItems = 'center';
      li.style.gap = '12px';

      const leftSection = document.createElement('div');
      leftSection.style.display = 'flex';
      leftSection.style.alignItems = 'center';
      leftSection.style.gap = '12px';
      leftSection.style.flex = '1';

      // Color swatch
      const colorSwatch = document.createElement('div');
      colorSwatch.style.cssText = `width: 24px; height: 24px; background-color: ${cal.color || '#6f42c1'}; border-radius: 6px; border: 2px solid #3a5f8a; flex-shrink: 0; cursor: pointer;`;
      colorSwatch.title = 'Click to change calendar color';
      colorSwatch.onclick = () => {
        const newColor = prompt('Enter a hex color (e.g., #ff5733) or choose from palette:\n#6f42c1, #3788d8, #28a745, #dc3545, #ffc107, #fd7e14, #17a2b8, #6610f2', cal.color || '#6f42c1');
        if (newColor && /^#[0-9A-F]{6}$/i.test(newColor)) {
          // Update calendar color
          cal.color = newColor;
          localStorage.setItem(GOOGLE_CALENDARS_KEY, JSON.stringify(addedCalendars));

          // Update all events from this calendar
          dayCalendar.getEvents()
            .filter(e => e.extendedProps?.googleCalendarId === cal.id)
            .forEach(e => {
              e.setProp('backgroundColor', newColor);
              e.setProp('borderColor', newColor);
              e.setExtendedProp('color', newColor);
            });

          syncCalendars();
          saveEvents();
          refreshAddedList();
          showToast(`Updated color for "${cal.name || cal.id}"`);
        } else if (newColor) {
          showToast('Invalid color format. Use hex format like #ff5733', 'error');
        }
      };

      const span = document.createElement('span');
      span.textContent = cal.name || cal.id;

      leftSection.appendChild(colorSwatch);
      leftSection.appendChild(span);
      li.appendChild(leftSection);

      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.className = 'btn btn-danger';
      removeBtn.style.padding = '4px 8px';
      removeBtn.style.fontSize = '0.8em';
      removeBtn.onclick = () => {
        if (confirm(`Remove "${cal.name || cal.id}" and all its events?`)) {
          dayCalendar.getEvents()
            .filter(e => e.extendedProps?.googleCalendarId === cal.id)
            .forEach(e => e.remove());
          addedCalendars = addedCalendars.filter(c => c.id !== cal.id);
          localStorage.setItem(GOOGLE_CALENDARS_KEY, JSON.stringify(addedCalendars));
          syncCalendars();
          saveEvents();
          refreshAddedList();
          showToast('Calendar removed');
        }
      };

      li.appendChild(removeBtn);
      addedCalendarsList.appendChild(li);
    });
  }

  addCalendarBtn.addEventListener('click', function () {
    googleModal.classList.add('active');
    calendarIdInput.focus();
    refreshAddedList();
  });

  importBtn.addEventListener('click', async function () {
    // FIX #1: Fixed undefined variable - use calendarIdInput.value instead of calendarIdValue
    const calendarId = calendarIdInput.value.trim();
    
    if (!calendarId) {
      showToast('Please enter Calendar ID', 'error');
      return;
    }

    // Check if calendarId is an iCal URL (Outlook format) or email/ID (Google format)
    const isICalUrl = calendarId.includes('calendar.google.com/calendar/ical/') || 
                     calendarId.includes('outlook.live.com') || 
                     calendarId.includes('outlook.office');

    if (isICalUrl) {
      showToast('Please enter Google Calendar ID (email address), not iCal URL', 'error');
      return;
    }

    // Save last used calendar ID
    localStorage.setItem(GOOGLE_SETTINGS_KEY, JSON.stringify({ calendarId }));

    importBtn.classList.add('loading');
    importBtn.disabled = true;

    try {
      // Check if already added
      if (addedCalendars.some(c => c.id === calendarId)) {
        showToast('This calendar is already added', 'error');
        googleModal.classList.remove('active');
        importBtn.classList.remove('loading');
        importBtn.disabled = false;
        return;
      }

      // Try Electron IPC first, fallback to localhost server
      let result;
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 2);
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 12);

      if (window.electronAPI && window.electronAPI.getCalendarEvents) {
        // Use Electron IPC
        result = await window.electronAPI.getCalendarEvents(
          calendarId,
          timeMin.toISOString(),
          timeMax.toISOString()
        );
      } else {
        // Fallback to localhost server (for development)
        const response = await fetch(
          `${PROXY_SERVER}/api/calendar/${encodeURIComponent(calendarId)}/events?` +
          `timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}`
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to fetch calendar');
        }

        const data = await response.json();
        result = { success: true, data };
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch calendar');
      }

      const { events, calendarInfo } = result.data;
      const calName = calendarInfo.summary || calendarId;
      let importCount = 0;

      // Assign a color from palette based on how many calendars are already added
      const colorIndex = addedCalendars.length % GOOGLE_COLOR_PALETTE.length;
      const calendarColor = GOOGLE_COLOR_PALETTE[colorIndex];

      const existingIds = new Set(dayCalendar.getEvents().map(e => e.extendedProps?.googleId));

      events.forEach(item => {
        if (existingIds.has(item.id)) return;

        const start = item.start.dateTime || item.start.date;
        const end = item.end.dateTime || item.end.date;
        const isAllDay = !item.start.dateTime;

        const event = {
          id: generateId(),
          title: item.summary || '(No title)',
          start: start,
          end: end,
          allDay: isAllDay,
          backgroundColor: calendarColor,
          borderColor: calendarColor,
          extendedProps: {
            googleId: item.id,
            color: calendarColor,
            imported: true,
            googleCalendarId: calendarId
          }
        };

        dayCalendar.addEvent(event);
        importCount++;
      });

      addedCalendars.push({ id: calendarId, name: calName, color: calendarColor });
      localStorage.setItem(GOOGLE_CALENDARS_KEY, JSON.stringify(addedCalendars));
      refreshAddedList();
      syncCalendars();
      saveEvents();
      googleModal.classList.remove('active');
      showToast(`Imported ${importCount} events from "${calName}"`);

    } catch (error) {
      console.error('Import error:', error);
      showToast(error.message || 'Failed to import calendar', 'error');
    } finally {
      importBtn.classList.remove('loading');
      importBtn.disabled = false;
    }
  });

  // Outlook Calendar Import - Standalone Solution
  const outlookIcalInput = document.getElementById('outlookIcalUrl');
  const addOutlookBtn = document.getElementById('addOutlookBtn');
  const removeOutlookBtn = document.getElementById('removeOutlookBtn');
  const outlookImportBtn = document.getElementById('outlookImportBtn');
  let outlookSyncInterval = null;
  let outlookUrls = new Map();

  // Load saved Outlook URLs
  const savedOutlookUrls = localStorage.getItem('outlook_urls');
  if (savedOutlookUrls) {
    try {
      const urls = JSON.parse(savedOutlookUrls);
      urls.forEach(item => outlookUrls.set(item.url, item));
    } catch (e) {
      console.error('Failed to load Outlook URLs:', e);
    }
  }

  addOutlookBtn.addEventListener('click', () => {
    outlookModal.classList.add('active');
    updateOutlookModal();
  });

  // Multiple proxy options for reliability
  const PROXIES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url='
  ];

  async function fetchWithFallback(url) {
    let lastError;
    for (const proxy of PROXIES) {
      try {
        const proxyUrl = proxy + encodeURIComponent(url);
        console.log(`Trying proxy: ${proxy}`);
        
        const response = await fetch(proxyUrl, {
          headers: {
            'Accept': 'text/calendar,text/plain,application/ics,*/*',
            'User-Agent': 'Mozilla/5.0 (compatible; CalendarApp/1.0)'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        
        // Validate it's iCal data
        if (text.includes('BEGIN:VCALENDAR') && text.includes('BEGIN:VEVENT')) {
          return text;
        }
        
        throw new Error('Invalid iCal data');
      } catch (error) {
        console.warn(`Proxy ${proxy} failed:`, error.message);
        lastError = error;
      }
    }
    throw lastError || new Error('All proxies failed');
  }

  async function importOutlookIcal() {
    const url = outlookIcalInput.value.trim();
    if (!url) {
      showToast('Please enter iCal URL', 'error');
      return;
    }

    outlookImportBtn.classList.add('loading');
    outlookImportBtn.disabled = true;

    try {
      const icalText = await fetchWithFallback(url);
      const events = parseICal(icalText, outlookUrls.get(url));

      if (events.length === 0) {
        throw new Error('No events found');
      }

      const urlParts = url.split('/');
      const calendarName = urlParts[urlParts.length - 1].replace('.ics', '') || 'Outlook Calendar';

      // Remove existing events
      const existing = dayCalendar.getEvents().filter(e => e.extendedProps?.outlookUrl === url);
      existing.forEach(e => e.remove());

      // Add new events
      events.forEach(ev => {
        ev.extendedProps.outlookUrl = url;
        ev.extendedProps.outlookCalendarName = calendarName;
        dayCalendar.addEvent(ev);
      });

      // Assign cycling color from palette
      const colorIndex = outlookUrls.size % OUTLOOK_COLOR_PALETTE.length;
      const color = OUTLOOK_COLOR_PALETTE[colorIndex];

      // Save URL to list
      outlookUrls.set(url, {
        url: url,
        name: calendarName,
        color: color,
        lastSync: new Date(),
        eventCount: events.length
      });

      localStorage.setItem('outlook_urls', JSON.stringify(Array.from(outlookUrls.values())));
      syncCalendars();
      saveEvents();
      showToast(`Successfully imported ${events.length} events from "${calendarName}"`);
      outlookModal.classList.remove('active');
      outlookIcalInput.value = '';

      // Start periodic sync
      if (!outlookSyncInterval) {
        startOutlookSync();
      }

    } catch (error) {
      console.error('Import error:', error);
      showToast(error.message || 'Failed to import calendar', 'error');
    } finally {
      outlookImportBtn.classList.remove('loading');
      outlookImportBtn.disabled = false;
    }
  }

  // Start periodic sync for all Outlook URLs
  function startOutlookSync() {
    if (outlookSyncInterval) {
      clearInterval(outlookSyncInterval);
    }

    // Sync every 10 minutes
    outlookSyncInterval = setInterval(async () => {
      if (outlookUrls.size === 0) {
        clearInterval(outlookSyncInterval);
        outlookSyncInterval = null;
        return;
      }

      for (const [url, info] of outlookUrls) {
        try {
          const icalText = await fetchWithFallback(url);
          const events = parseICal(icalText, info);

          // Remove existing events for this URL
          const existing = dayCalendar.getEvents().filter(e => e.extendedProps?.outlookUrl === url);
          existing.forEach(e => e.remove());

          // Add updated events
          events.forEach(ev => {
            ev.extendedProps.outlookUrl = url;
            ev.extendedProps.outlookCalendarName = info.name;
            dayCalendar.addEvent(ev);
          });

          // Update sync info
          info.lastSync = new Date();
          info.eventCount = events.length;
        } catch (error) {
          console.error(`Failed to sync ${url}:`, error);
        }
      }

      localStorage.setItem('outlook_urls', JSON.stringify(Array.from(outlookUrls.values())));
      syncCalendars();
      saveEvents();
      console.log('Outlook calendars synced');
    }, 10 * 60 * 1000);
  }

  // Update Outlook modal UI
  function updateOutlookModal() {
    const outlookStatus = document.getElementById('outlookStatus');
    const outlookCalendarsSection = document.getElementById('outlookCalendarsSection');
    const outlookActionsSection = document.getElementById('outlookActionsSection');

    if (outlookUrls.size === 0) {
      outlookStatus.textContent = 'No calendars added';
      outlookStatus.style.background = 'rgba(55, 136, 216, 0.1)';
      outlookCalendarsSection.style.display = 'none';
      outlookActionsSection.style.display = 'none';
    } else {
      outlookStatus.textContent = `${outlookUrls.size} calendar(s) added`;
      outlookStatus.style.background = 'rgba(40, 167, 69, 0.1)';
      outlookCalendarsSection.style.display = 'block';
      outlookActionsSection.style.display = 'block';

      // Update calendars list
      const outlookCalendarsList = document.getElementById('outlookCalendarsList');
      outlookCalendarsList.innerHTML = '';

      for (const [url, info] of outlookUrls) {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 10px; border: 1px solid #1e3a5f; border-radius: 8px; margin-bottom: 10px;';

        const swatch = info.color ? `<div style="width: 24px; height: 24px; background-color: ${info.color}; border-radius: 6px; border: 2px solid #3a5f8a; margin-right: 12px; flex-shrink: 0;"></div>` : '';

        div.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="display: flex; align-items: start; flex: 1;">
              ${swatch}
              <div>
                <div style="font-weight: 500; margin-bottom: 5px;">${info.name}</div>
                <div style="font-size: 0.85em; color: #5a7a9a; margin-bottom: 3px;">
                  Events: ${info.eventCount || 0}
                </div>
                <div style="font-size: 0.85em; color: #5a7a9a;">
                  Last sync: ${info.lastSync ? new Date(info.lastSync).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>
            <button class="btn btn-danger outlook-remove-btn" style="padding: 4px 8px; font-size: 0.8em;" data-url="${url}">Remove</button>
          </div>
        `;

        outlookCalendarsList.appendChild(div);
      }

      // FIX #2: Use event delegation for dynamically created remove buttons
      outlookCalendarsList.querySelectorAll('.outlook-remove-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const url = this.getAttribute('data-url');
          removeOutlookUrl(url);
        });
      });
    }
  }

  // FIX #3: Made removeOutlookUrl a regular function instead of window property
  function removeOutlookUrl(url) {
    if (confirm('Remove this calendar and all its events?')) {
      // Remove events
      const existing = dayCalendar.getEvents().filter(e => e.extendedProps?.outlookUrl === url);
      existing.forEach(e => e.remove());

      // Remove from storage
      outlookUrls.delete(url);
      localStorage.setItem('outlook_urls', JSON.stringify(Array.from(outlookUrls.values())));

      syncCalendars();
      saveEvents();
      updateOutlookModal();
      showToast('Calendar removed');
    }
  }

  // Event listeners
  outlookImportBtn.addEventListener('click', importOutlookIcal);

  if (removeOutlookBtn) {
    removeOutlookBtn.addEventListener('click', () => {
      outlookModal.classList.add('active');
      updateOutlookModal();
    });
  }

  // Enhanced iCal parser function
  function parseICal(icalText, calendarInfo = null) {
    const events = [];

    // Normalize line endings and split
    const lines = icalText.replace(/\r\n/g, '\n').split('\n');
    let currentEvent = null;
    let inVEvent = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Handle folded lines (iCal lines that start with a space are continuations)
      while (i + 1 < lines.length && lines[i + 1].startsWith(' ')) {
        line += lines[i + 1].substring(1);
        i++;
      }

      if (line === 'BEGIN:VEVENT') {
        currentEvent = {};
        inVEvent = true;
      } else if (line === 'END:VEVENT') {
        if (currentEvent && inVEvent) {
          try {
            const event = parseEvent(currentEvent, calendarInfo);
            if (event) {
              events.push(event);
            }
          } catch (e) {
            console.warn('Failed to parse event:', e);
          }
        }
        currentEvent = null;
        inVEvent = false;
      } else if (inVEvent && currentEvent && line.includes(':')) {
        // Handle properties with parameters
        let colonIndex = line.indexOf(':');
        let semicolonIndex = line.indexOf(';');
        let key, value;

        if (semicolonIndex !== -1 && semicolonIndex < colonIndex) {
          key = line.substring(0, semicolonIndex);
          value = line.substring(colonIndex + 1);
        } else {
          key = line.substring(0, colonIndex);
          value = line.substring(colonIndex + 1);
        }

        // Decode quoted printable if needed
        if (value.includes('=') && (value.includes('0A') || value.includes('0D'))) {
          value = decodeQuotedPrintable(value);
        }

        currentEvent[key] = value;
      }
    }

    return events;
  }

  // Parse individual event from iCal data
  function parseEvent(eventData, calendarInfo = null) {
    const summary = eventData.SUMMARY || '(No title)';

    // Parse dates
    let start, end, isAllDay = false;

    if (eventData.DTSTART) {
      const startDate = parseICalDate(eventData.DTSTART);
      start = startDate.date;
      isAllDay = startDate.isAllDay;
    }

    if (eventData.DTEND) {
      const endDate = parseICalDate(eventData.DTEND);
      end = endDate.date;

      // If start is all-day, end should be treated as all-day too
      if (isAllDay) {
        // For all-day events, the end date is often the next day
        end.setHours(0, 0, 0, 0);
      }
    } else if (eventData.DURATION) {
      // Handle DURATION property
      end = new Date(start);
      const duration = eventData.DURATION;
      
      // Simple duration parsing (e.g., PT1H for 1 hour)
      const match = duration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
      if (match) {
        if (match[1]) end.setDate(end.getDate() + parseInt(match[1]));
        if (match[2]) end.setHours(end.getHours() + parseInt(match[2]));
        if (match[3]) end.setMinutes(end.getMinutes() + parseInt(match[3]));
      }
    } else {
      // Default to 1 hour duration if no end specified
      end = new Date(start.getTime() + 3600000);
    }

    // Validate dates
    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format in event');
    }

    // Use calendar-specific color if available, fallback to orange
    const color = calendarInfo?.color || '#fd7e14';

    return {
      id: generateId(),
      title: summary,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: isAllDay,
      backgroundColor: color,
      borderColor: color,
      extendedProps: {
        importedOutlook: true,
        outlookEvent: true,
        originalData: eventData
      }
    };
  }

  // Parse iCal date format
  function parseICalDate(dateStr) {
    // Remove VALUE=DATE prefix if present
    dateStr = dateStr.replace(/^^VALUE=DATE:/, '');

    // Handle timezone if present (e.g., 20240115T100000Z)
    let isUTC = dateStr.endsWith('Z');
    if (isUTC) {
      dateStr = dateStr.slice(0, -1);
    }

    const isAllDay = !dateStr.includes('T');
    let date;

    if (isAllDay) {
      // Format: YYYYMMDD
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-based
      const day = parseInt(dateStr.substring(6, 8));
      date = new Date(Date.UTC(year, month, day));
    } else {
      // Format: YYYYMMDDTHHMMSS
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(dateStr.substring(9, 11));
      const minute = parseInt(dateStr.substring(11, 13));
      const second = parseInt(dateStr.substring(13, 15) || 0);

      if (isUTC) {
        date = new Date(Date.UTC(year, month, day, hour, minute, second));
      } else {
        date = new Date(year, month, day, hour, minute, second);
      }
    }

    return { date, isAllDay };
  }

  // Decode quoted printable strings
  function decodeQuotedPrintable(str) {
    return str.replace(/=([0-9A-F]{2})/gi, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
  }

  // Initialize Outlook modal on load
  updateOutlookModal();

  // Keyboard shortcut: 'n' for new event
  document.addEventListener('keydown', function (e) {
    if (e.key === 'n' && 
        !(eventModal?.classList?.contains('active')) && 
        !(googleModal?.classList?.contains('active')) && 
        !(outlookModal?.classList?.contains('active'))) {
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const now = new Date();
        now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
        const end = new Date(now.getTime() + 3600000);
        openEventModal(null, now, end);
      }
    }
  });

  // Initial selection highlight for today
  setTimeout(() => {
    const todayCell = document.querySelector('#monthCalendar .fc-day-today');
    if (todayCell) {
      todayCell.classList.add('fc-day-selected');
    }
  }, 100);
});