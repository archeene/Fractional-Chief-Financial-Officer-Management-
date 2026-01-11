// Dashboard JavaScript

// Toast Notification System
function showToast(message, type = 'success', duration = 3000) {
  // Remove any existing toast
  const existingToast = document.querySelector('.toast-notification');
  if (existingToast) {
    existingToast.remove();
  }

  // Icon based on type
  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
  };

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close">×</button>
  `;

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Close button
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  });

  // Auto dismiss
  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
      }
    }, duration);
  }

  return toast;
}

// Custom Confirmation Modal System
function showConfirmModal(options = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmModalOverlay');
    const icon = document.getElementById('confirmModalIcon');
    const title = document.getElementById('confirmModalTitle');
    const message = document.getElementById('confirmModalMessage');
    const details = document.getElementById('confirmModalDetails');
    const confirmBtn = document.getElementById('confirmModalConfirm');
    const cancelBtn = document.getElementById('confirmModalCancel');

    // Set content
    icon.textContent = options.icon || '⚠️';
    title.textContent = options.title || 'Confirm Action';
    message.textContent = options.message || 'Are you sure you want to proceed?';
    details.textContent = options.details || '';
    confirmBtn.textContent = options.confirmText || 'Confirm';

    // Handle warning-only modals (no cancel button)
    if (options.cancelText === null) {
      cancelBtn.style.display = 'none';
    } else {
      cancelBtn.style.display = '';
      cancelBtn.textContent = options.cancelText || 'Cancel';
    }

    // Set button style based on type
    if (options.type === 'danger') {
      confirmBtn.style.background = '#ff4444';
      confirmBtn.style.borderColor = '#ff4444';
    } else if (options.type === 'warning') {
      confirmBtn.style.background = '#ffaa00';
      confirmBtn.style.borderColor = '#ffaa00';
      confirmBtn.style.color = '#0a0e27';
    } else {
      confirmBtn.style.background = '#00ff41';
      confirmBtn.style.borderColor = '#00ff41';
      confirmBtn.style.color = '#0a0e27';
    }

    // Show modal
    overlay.classList.add('active');

    // Handle confirm
    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    // Handle cancel
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    // Handle escape key
    const handleKeydown = (e) => {
      if (e.key === 'Escape') handleCancel();
      if (e.key === 'Enter') handleConfirm();
    };

    // Handle click outside
    const handleOverlayClick = (e) => {
      if (e.target === overlay) handleCancel();
    };

    // Cleanup function
    const cleanup = () => {
      overlay.classList.remove('active');
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeydown);
      overlay.removeEventListener('click', handleOverlayClick);
    };

    // Attach event listeners
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    document.addEventListener('keydown', handleKeydown);
    overlay.addEventListener('click', handleOverlayClick);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  console.log('Dashboard loaded');

  // Listen for external link requests from email iframe
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'openExternalLink' && event.data.url) {
      console.log('Opening external link:', event.data.url);
      // Use Electron API if available, otherwise fallback to window.open
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(event.data.url);
      } else {
        window.open(event.data.url, '_blank');
      }
    }
  });

  // Initialize flight tracker (from flight-tracker.js)
  const flightTracker = window.FlightTracker ? new window.FlightTracker() : null;

  // Storage keys
  const STORAGE_KEY = 'calendar_events';
  const CLIENTS_KEY = 'cfo_clients';
  const GOOGLE_SETTINGS_KEY = 'google_calendar_settings';
  const GOOGLE_CALENDARS_KEY = 'google_calendars';
  const OUTLOOK_SETTINGS_KEY = 'outlook_settings';

  // Timezone Database - loaded from timezone-cities.js (500+ cities)
  // Use window.TimezoneCities which is loaded from the external file
  const getTimezones = () => window.TimezoneCities || {};

  let selectedTimezone = null;
  let selectedCityName = null;
  let selectedUtcOffset = null; // For manual UTC offset
  const TIMEZONE_KEY = 'selected_timezone';
  const CITY_NAME_KEY = 'selected_city_name';
  const UTC_OFFSET_KEY = 'selected_utc_offset';
  const RECENT_CITIES_KEY = 'recent_timezone_cities';
  const MAX_RECENT_CITIES = 5;

  // Load saved timezone
  function loadSavedTimezone() {
    const saved = localStorage.getItem(TIMEZONE_KEY);
    const savedCity = localStorage.getItem(CITY_NAME_KEY);
    const savedOffset = localStorage.getItem(UTC_OFFSET_KEY);

    if (savedOffset !== null && savedOffset !== '') {
      // Manual UTC offset takes precedence
      selectedUtcOffset = parseFloat(savedOffset);
      selectedTimezone = null;
      selectedCityName = savedCity || `UTC${selectedUtcOffset >= 0 ? '+' : ''}${selectedUtcOffset}`;
      updateCityDisplay();
    } else if (saved) {
      selectedTimezone = saved;
      selectedCityName = savedCity;
      selectedUtcOffset = null;
      updateCityDisplay();
    }
  }

  // Update city name display
  function updateCityDisplay() {
    const cityElement = document.getElementById('timezoneCity');
    if (cityElement) {
      cityElement.textContent = selectedCityName ? selectedCityName.toUpperCase() : 'LOCAL';
    }
  }

  // Initialize clock
  function updateClock() {
    const now = new Date();

    let timeStr, dateStr;

    if (selectedUtcOffset !== null) {
      // Manual UTC offset - calculate time manually
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      const offsetTime = new Date(utcTime + (selectedUtcOffset * 3600000));

      timeStr = offsetTime.toLocaleTimeString('en-US', { hour12: false });
      dateStr = offsetTime.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).toUpperCase();

      // Format UTC offset string
      const sign = selectedUtcOffset >= 0 ? '+' : '';
      const hours = Math.floor(Math.abs(selectedUtcOffset));
      const minutes = Math.round((Math.abs(selectedUtcOffset) % 1) * 60);
      const offsetStr = minutes > 0 ? `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}` : `UTC${sign}${selectedUtcOffset}`;
      timeStr += ` ${offsetStr}`;
    } else if (selectedTimezone) {
      timeStr = now.toLocaleTimeString('en-US', {
        hour12: false,
        timeZone: selectedTimezone
      });
      dateStr = now.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: selectedTimezone
      }).toUpperCase();

      // Get timezone abbreviation
      const tzAbbr = new Intl.DateTimeFormat('en-US', {
        timeZone: selectedTimezone,
        timeZoneName: 'short'
      }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value || '';

      timeStr += ` ${tzAbbr}`;
    } else {
      timeStr = now.toLocaleTimeString('en-US', { hour12: false });
      dateStr = now.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).toUpperCase();
    }

    document.getElementById('clock').textContent = timeStr;
    document.getElementById('date').textContent = dateStr;
  }

  // Timezone button handler
  // Timezone Modal Functionality
  const timezoneModal = document.getElementById('timezoneModal');
  const closeTimezoneModal = document.getElementById('closeTimezoneModal');
  const timezoneSearch = document.getElementById('timezoneSearch');
  const timezoneList = document.getElementById('timezoneList');
  const recentCitiesList = document.getElementById('recentCitiesList');
  const recentCitiesSection = document.getElementById('recentCitiesSection');

  // Get recent cities from localStorage
  function getRecentCities() {
    const stored = localStorage.getItem(RECENT_CITIES_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  // Save city to recent list
  function addToRecentCities(city) {
    let recent = getRecentCities();
    // Remove if already exists
    recent = recent.filter(c => c !== city);
    // Add to beginning
    recent.unshift(city);
    // Limit to MAX_RECENT_CITIES
    recent = recent.slice(0, MAX_RECENT_CITIES);
    localStorage.setItem(RECENT_CITIES_KEY, JSON.stringify(recent));
  }

  // Populate recent cities section
  function populateRecentCities() {
    // Always show recent cities section (for Local Time button)
    recentCitiesSection.style.display = 'block';
    recentCitiesList.innerHTML = '';

    // Add Local Time button first (permanent)
    const localTimeBtn = document.createElement('div');
    localTimeBtn.className = 'timezone-list-item local-time-btn';
    localTimeBtn.textContent = '🏠 Local Time';
    localTimeBtn.addEventListener('click', () => {
      localStorage.removeItem(TIMEZONE_KEY);
      localStorage.removeItem(CITY_NAME_KEY);
      localStorage.removeItem(UTC_OFFSET_KEY);
      selectedTimezone = null;
      selectedCityName = null;
      selectedUtcOffset = null;
      updateClock();
      updateCityDisplay();
      timezoneModal.classList.remove('active');
      // Reset UTC offset dropdown
      const utcSelect = document.getElementById('utcOffsetSelect');
      if (utcSelect) utcSelect.value = '';
    });
    recentCitiesList.appendChild(localTimeBtn);

    // Add recent cities after Local Time button
    const recent = getRecentCities();
    const timezones = getTimezones();
    recent.forEach(city => {
      if (timezones[city]) {
        const item = document.createElement('div');
        item.className = 'timezone-list-item';
        item.textContent = city;
        item.dataset.city = city;
        item.addEventListener('click', () => selectCity(city));
        recentCitiesList.appendChild(item);
      }
    });
  }

  // Initialize timezone modal (no longer populates all cities)
  function populateTimezoneList() {
    // Just populate recent cities - search results show on demand
    populateRecentCities();

    // Hide search results initially
    const searchResultsSection = document.getElementById('searchResultsSection');
    if (searchResultsSection) {
      searchResultsSection.style.display = 'none';
    }
  }

  // Search timezone list - shows results only when searching
  function filterTimezoneList() {
    const searchTerm = timezoneSearch.value.toLowerCase().trim();
    const timezoneList = document.getElementById('timezoneList');
    const searchResultsSection = document.getElementById('searchResultsSection');
    const searchResultsCount = document.getElementById('searchResultsCount');
    const timezones = getTimezones();

    if (!searchTerm || searchTerm.length < 2) {
      // Hide search results when not searching
      if (searchResultsSection) searchResultsSection.style.display = 'none';
      return;
    }

    // Show search results section
    if (searchResultsSection) searchResultsSection.style.display = 'block';

    // Search through all cities
    const matchingCities = Object.keys(timezones)
      .filter(city => city.toLowerCase().includes(searchTerm))
      .sort()
      .slice(0, 20); // Limit to 20 results

    // Update count
    if (searchResultsCount) {
      searchResultsCount.textContent = `(${matchingCities.length}${matchingCities.length >= 20 ? '+' : ''})`;
    }

    // Populate results
    timezoneList.innerHTML = '';
    matchingCities.forEach(city => {
      const item = document.createElement('div');
      item.className = 'timezone-list-item';
      item.textContent = city;
      item.dataset.city = city;
      item.addEventListener('click', () => selectCity(city));
      timezoneList.appendChild(item);
    });

    if (matchingCities.length === 0) {
      timezoneList.innerHTML = '<div class="no-results">No cities found matching "' + timezoneSearch.value + '"</div>';
    }
  }

  // Select a city
  function selectCity(city) {
    const timezones = getTimezones();
    selectedTimezone = timezones[city];
    selectedCityName = city;
    selectedUtcOffset = null; // Clear UTC offset when selecting a city
    localStorage.setItem(TIMEZONE_KEY, selectedTimezone);
    localStorage.setItem(CITY_NAME_KEY, city);
    localStorage.removeItem(UTC_OFFSET_KEY); // Clear UTC offset
    addToRecentCities(city); // Add to recent cities
    updateClock();
    updateCityDisplay();
    timezoneModal.classList.remove('active');
    timezoneSearch.value = '';
    filterTimezoneList();
    // Reset UTC offset dropdown
    const utcSelect = document.getElementById('utcOffsetSelect');
    if (utcSelect) utcSelect.value = '';
  }

  // Reset to local time
  function resetToLocalTime() {
    selectedTimezone = null;
    selectedCityName = null;
    selectedUtcOffset = null;
    localStorage.removeItem(TIMEZONE_KEY);
    localStorage.removeItem(CITY_NAME_KEY);
    localStorage.removeItem(UTC_OFFSET_KEY);
    updateClock();
    updateCityDisplay();
    timezoneModal.classList.remove('active');
  }

  // Apply manual UTC offset
  const applyUtcOffsetBtn = document.getElementById('applyUtcOffset');
  const utcOffsetSelect = document.getElementById('utcOffsetSelect');

  if (applyUtcOffsetBtn && utcOffsetSelect) {
    applyUtcOffsetBtn.addEventListener('click', () => {
      const offsetValue = utcOffsetSelect.value;
      if (offsetValue === '') {
        alert('Please select a UTC offset');
        return;
      }

      const offset = parseFloat(offsetValue);
      selectedUtcOffset = offset;
      selectedTimezone = null;

      // Format the display name
      const sign = offset >= 0 ? '+' : '';
      const hours = Math.floor(Math.abs(offset));
      const minutes = Math.round((Math.abs(offset) % 1) * 60);
      selectedCityName = minutes > 0 ? `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}` : `UTC${sign}${offset}`;

      localStorage.setItem(UTC_OFFSET_KEY, offset.toString());
      localStorage.setItem(CITY_NAME_KEY, selectedCityName);
      localStorage.removeItem(TIMEZONE_KEY);

      updateClock();
      updateCityDisplay();
      timezoneModal.classList.remove('active');
    });
  }

  // Open timezone modal
  document.getElementById('timezoneBtn')?.addEventListener('click', () => {
    populateTimezoneList();
    timezoneModal.classList.add('active');
    timezoneSearch.focus();
  });

  // Close timezone modal
  closeTimezoneModal?.addEventListener('click', () => {
    timezoneModal.classList.remove('active');
    timezoneSearch.value = '';
    filterTimezoneList();
  });

  // Close on background click
  timezoneModal?.addEventListener('click', (e) => {
    if (e.target === timezoneModal) {
      timezoneModal.classList.remove('active');
      timezoneSearch.value = '';
      filterTimezoneList();
    }
  });

  // Search functionality
  timezoneSearch?.addEventListener('input', filterTimezoneList);

  loadSavedTimezone();
  updateClock();
  setInterval(updateClock, 1000);

  // View switching
  const navBtns = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewName = btn.dataset.view;

      // Update active nav button
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update active view
      views.forEach(v => v.classList.remove('active'));
      document.getElementById(`${viewName}-view`).classList.add('active');

      // Render calendars when switching to calendar view
      if (viewName === 'calendar' && !window.calendarsInitialized) {
        initializeCalendars();
      }

      // Check Gmail auth when switching to email view
      if (viewName === 'email') {
        checkGmailAuthOnViewSwitch();
      }

      // Refresh files view when switching to it
      if (viewName === 'files' && typeof window.refreshFilesView === 'function') {
        window.refreshFilesView();
      }
    });
  });

  // Gmail auth check function for view switching (defined early, called later)
  async function checkGmailAuthOnViewSwitch() {
    try {
      const response = await fetch('http://localhost:3001/api/gmail/profile');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('✅ Gmail authenticated on view switch:', data.email);
          const loginSection = document.getElementById('emailLoginSection');
          const mainView = document.getElementById('emailMainView');
          if (loginSection) loginSection.style.display = 'none';
          if (mainView) mainView.style.display = 'grid';
          // Load emails
          const emailListView = document.getElementById('emailListView');
          if (emailListView && (!emailListView.children.length || emailListView.querySelector('.email-loading'))) {
            // Fetch and display emails
            try {
              emailListView.innerHTML = '<div class="email-loading">Loading emails...</div>';
              const emailsResponse = await fetch('http://localhost:3001/api/gmail/messages?labelIds=INBOX&maxResults=30');
              const emailsData = await emailsResponse.json();
              if (emailsData.success && emailsData.messages) {
                // Store emails globally for AI assistant access
                window.loadedEmails = emailsData.messages;
                console.log('📧 Stored', emailsData.messages.length, 'emails for AI context');
                emailListView.innerHTML = emailsData.messages.map(email => {
                  const fromName = email.from.split('<')[0].trim().replace(/"/g, '') || email.from;
                  const date = new Date(email.date);
                  const isToday = date.toDateString() === new Date().toDateString();
                  const dateStr = isToday ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const unreadClass = email.isUnread ? 'unread' : '';
                  return `
                    <div class="email-item ${unreadClass}" data-email-id="${email.id}">
                      <div class="email-sender">${fromName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                      <div class="email-subject">${(email.subject || '(No Subject)').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                      <div class="email-preview">${(email.snippet || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                      <div class="email-date">${dateStr}</div>
                    </div>
                  `;
                }).join('');
              }
            } catch (e) {
              console.error('Error loading emails:', e);
            }
          }
        }
      }
    } catch (error) {
      console.log('Gmail auth check on view switch failed');
    }
  }

  // ==========================================
  // Helper Functions for Files and Photos
  // ==========================================
  function getFileIcon(mimeType) {
    if (!mimeType) return '📄';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📘';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📗';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📙';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
    if (mimeType.includes('internet-shortcut') || mimeType.includes('url')) return '🔗';
    return '📄';
  }

  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // ==========================================
  // HP Bar Helper Functions
  // ==========================================

  // Core HP bar update - works with element references
  function updateHudHpBar(input, bar) {
    if (!input || !bar) return;
    const hp = Math.max(0, Math.min(100, parseInt(input.value) || 0));
    bar.style.width = hp + '%';
    bar.classList.remove('hp-high', 'hp-medium', 'hp-low');
    if (hp > 50) bar.classList.add('hp-high');
    else if (hp > 25) bar.classList.add('hp-medium');
    else bar.classList.add('hp-low');
  }

  // ID-based wrapper with event listeners for modals
  function updateHpBar(inputId, barId) {
    const input = document.getElementById(inputId);
    const bar = document.getElementById(barId);
    if (!input || !bar) return;

    const doUpdate = () => updateHudHpBar(input, bar);
    input.addEventListener('input', doUpdate);
    input.addEventListener('change', doUpdate);
    doUpdate();
  }

  function resetHpBar(inputId, barId) {
    const input = document.getElementById(inputId);
    const bar = document.getElementById(barId);
    if (input) input.value = 100;
    if (bar) {
      bar.style.width = '100%';
      bar.classList.remove('hp-medium', 'hp-low');
      bar.classList.add('hp-high');
    }
  }

  // ==========================================
  // Styled Delete Confirmation Dialog
  // ==========================================
  function showDeleteConfirm(name, type, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-dialog-header">
          <span class="confirm-dialog-icon">⚠️</span>
          <span class="confirm-dialog-title">CONFIRM DELETE</span>
        </div>
        <div class="confirm-dialog-body">
          <p>Are you sure you want to delete this ${type}?</p>
          <span class="confirm-dialog-name">${name}</span>
          <p class="confirm-dialog-warning">This action cannot be undone.</p>
        </div>
        <div class="confirm-dialog-footer">
          <button class="confirm-dialog-btn cancel">CANCEL</button>
          <button class="confirm-dialog-btn delete">DELETE</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.confirm-dialog-btn.cancel').addEventListener('click', () => {
      overlay.remove();
    });

    overlay.querySelector('.confirm-dialog-btn.delete').addEventListener('click', () => {
      onConfirm();
      overlay.remove();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // Client Management
  const defaultClients = [
    { id: 'techcorp', name: 'TechCorp', location: 'New York, USA', color: '#3788d8', status: 'Active' },
    { id: 'globaltrade', name: 'GlobalTrade', location: 'London, UK', color: '#28a745', status: 'Active' },
    { id: 'startupxyz', name: 'StartupXYZ', location: 'Singapore', color: '#dc3545', status: 'Active' },
    { id: 'financehub', name: 'FinanceHub', location: 'Toronto, Canada', color: '#ffc107', status: 'Active' },
    { id: 'innovateai', name: 'InnovateAI', location: 'San Francisco, USA', color: '#6f42c1', status: 'Active' }
  ];

  function loadClients() {
    const stored = localStorage.getItem(CLIENTS_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse clients:', e);
        return defaultClients;
      }
    }
    // Save default clients on first load
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(defaultClients));
    return defaultClients;
  }

  function saveClients(clients) {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  }

  function renderClients() {
    const clients = loadClients();
    const clientList = document.getElementById('clientList');
    clientList.innerHTML = '';

    clients.forEach(client => {
      const clientItem = document.createElement('div');
      clientItem.className = 'client-item';
      clientItem.dataset.clientId = client.id;
      clientItem.innerHTML = `
        <span class="client-name">${client.name}</span>
        <span class="client-location">${client.location}</span>
        <span class="client-status">${client.status}</span>
      `;

      clientItem.addEventListener('click', () => {
        openClientHUD(client);
      });

      clientList.appendChild(clientItem);
    });
  }

  // Client HUD
  let currentClient = null; // Track currently displayed client
  let clientHudPhoto = null; // Track photo for client HUD

  function openClientHUD(client) {
    currentClient = client; // Store for delete functionality
    clientHudPhoto = client.photo || null;

    const hudOverlay = document.getElementById('hudOverlay');
    document.getElementById('hudClientName').textContent = client.name;

    // Populate editable form fields
    document.getElementById('clientHudNameInput').value = client.name || '';
    document.getElementById('clientHudLocationInput').value = client.location || '';
    document.getElementById('clientHudEmailInput').value = client.email || '';
    document.getElementById('clientHudPhoneInput').value = client.phone || '';
    const preferredContactEl = document.getElementById('clientHudPreferredContactInput');
    const businessEl = document.getElementById('clientHudBusinessInput');
    const revenueEl = document.getElementById('clientHudRevenueInput');
    if (preferredContactEl) preferredContactEl.value = client.preferredContact || '';
    if (businessEl) businessEl.value = client.business || '';
    if (revenueEl) revenueEl.value = client.revenue || '';
    document.getElementById('clientHudNotesInput').value = client.notes || '';

    // Photo
    const photoContainer = document.getElementById('clientHudPhoto');
    const photoRemoveBtn = document.getElementById('clientHudPhotoRemove');
    if (client.photo) {
      photoContainer.innerHTML = `<img src="${client.photo}" class="hud-photo-img" alt="${client.name}">`;
      photoRemoveBtn.style.display = 'inline-block';
    } else {
      photoContainer.innerHTML = '<div class="hud-photo-placeholder">👤</div>';
      photoRemoveBtn.style.display = 'none';
    }

    // HP Bar with editable input
    const hp = client.hp !== undefined ? client.hp : 100;
    const hpInput = document.getElementById('clientHudHpInput');
    const hpBar = document.getElementById('clientHudHpBar');
    hpInput.value = hp;
    updateHudHpBar(hpInput, hpBar);

    // Add change listener for HP input
    hpInput.oninput = () => {
      updateHudHpBar(hpInput, hpBar);
    };

    // Files - load from disk
    loadAndRenderHudFiles('client', client.id, 'clientHudFiles', client.name);

    hudOverlay.classList.add('active');
  }

  // Load and render files for HUD cards
  async function loadAndRenderHudFiles(ownerType, ownerId, containerId, ownerName = null) {
    const filesContainer = document.getElementById(containerId);
    if (!filesContainer) return;

    // Check if Electron API is available
    if (window.electronAPI && window.electronAPI.getFiles) {
      try {
        const result = await window.electronAPI.getFiles({ ownerType, ownerId, ownerName });
        if (result.success && result.files.length > 0) {
          filesContainer.innerHTML = result.files.map(file => {
            const isLink = file.isLink || file.type === 'link';
            const linkClass = isLink ? ' link-item' : '';
            const icon = isLink ? '🔗' : getFileIcon(file.type);
            const sizeOrUrl = isLink ? 'External Link' : formatFileSize(file.size);
            return `
            <div class="hud-file-item${linkClass}" data-safe-name="${file.safeName}" data-path="${file.path}" data-is-link="${isLink}" data-url="${file.url || ''}">
              <span class="hud-file-icon">${icon}</span>
              <div class="hud-file-info">
                <div class="hud-file-name">${file.name}</div>
                <div class="hud-file-size">${sizeOrUrl}</div>
              </div>
              <button class="hud-file-delete" data-owner-type="${ownerType}" data-owner-id="${ownerId}" data-owner-name="${ownerName || ''}" data-safe-name="${file.safeName}" data-file-name="${file.name}" title="Delete">✕</button>
            </div>
          `}).join('');

          // Add click handlers for opening files/links
          filesContainer.querySelectorAll('.hud-file-item').forEach(item => {
            item.addEventListener('click', async (e) => {
              if (e.target.classList.contains('hud-file-delete')) return;
              const isLink = item.dataset.isLink === 'true';
              if (isLink) {
                // Open link in external browser
                const url = item.dataset.url;
                if (url && window.electronAPI.openExternal) {
                  await window.electronAPI.openExternal(url);
                }
              } else {
                // Open file normally
                const filePath = item.dataset.path;
                if (filePath && window.electronAPI.openFile) {
                  await window.electronAPI.openFile(filePath);
                }
              }
            });
          });

          // Add delete handlers
          filesContainer.querySelectorAll('.hud-file-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const safeName = btn.dataset.safeName;
              const fileName = btn.dataset.fileName;
              const ownerType = btn.dataset.ownerType;
              const ownerId = btn.dataset.ownerId;
              const ownerName = btn.dataset.ownerName || null;

              const confirmed = await showConfirmModal({
                icon: '🗑️',
                title: 'Delete File',
                message: 'Are you sure you want to delete this file?',
                details: fileName,
                confirmText: 'Delete',
                cancelText: 'Cancel',
                type: 'danger'
              });

              if (confirmed) {
                const result = await window.electronAPI.deleteFile({ ownerType, ownerId, ownerName, safeName });
                if (result.success) {
                  showToast('File deleted', 'success');
                  loadAndRenderHudFiles(ownerType, ownerId, containerId, ownerName);
                } else {
                  showToast('Error deleting file', 'error');
                }
              }
            });
          });
        } else {
          filesContainer.innerHTML = '<div class="hud-item">No files attached</div>';
        }
      } catch (error) {
        console.error('Error loading files:', error);
        filesContainer.innerHTML = '<div class="hud-item">Error loading files</div>';
      }
    } else {
      filesContainer.innerHTML = '<div class="hud-item">No files attached</div>';
    }
  }

  // Client HUD Photo upload
  document.getElementById('clientHudPhotoBtn')?.addEventListener('click', () => {
    document.getElementById('clientHudPhotoInput').click();
  });

  document.getElementById('clientHudPhotoInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        clientHudPhoto = event.target.result;
        document.getElementById('clientHudPhoto').innerHTML = `<img src="${clientHudPhoto}" class="hud-photo-img" alt="Photo">`;
        document.getElementById('clientHudPhotoRemove').style.display = 'inline-block';
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('clientHudPhotoRemove')?.addEventListener('click', () => {
    clientHudPhoto = null;
    document.getElementById('clientHudPhoto').innerHTML = '<div class="hud-photo-placeholder">👤</div>';
    document.getElementById('clientHudPhotoRemove').style.display = 'none';
    document.getElementById('clientHudPhotoInput').value = '';
  });

  // Client HUD File upload handler
  document.getElementById('clientHudAttachBtn')?.addEventListener('click', () => {
    document.getElementById('clientHudFileInput').click();
  });

  document.getElementById('clientHudFileInput')?.addEventListener('change', async (e) => {
    if (!currentClient || !window.electronAPI?.saveFile) return;

    const files = Array.from(e.target.files);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = await window.electronAPI.saveFile({
          ownerType: 'client',
          ownerId: currentClient.id,
          ownerName: currentClient.name,
          fileName: file.name,
          fileData: event.target.result,
          fileType: file.type,
          fileSize: file.size
        });

        if (result.success) {
          showToast(`File "${file.name}" uploaded`, 'success');
          loadAndRenderHudFiles('client', currentClient.id, 'clientHudFiles', currentClient.name);
        } else {
          showToast(`Error uploading ${file.name}: ${result.error || 'Unknown error'}`, 'error');
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  });

  // ============================================
  // ADD LINK MODAL FUNCTIONALITY
  // ============================================
  let addLinkContext = null; // Stores { ownerType, ownerId, ownerName, containerId }

  function showAddLinkModal(ownerType, ownerId, ownerName, containerId) {
    addLinkContext = { ownerType, ownerId, ownerName, containerId };
    document.getElementById('addLinkName').value = '';
    document.getElementById('addLinkUrl').value = '';
    document.getElementById('addLinkModalOverlay').classList.add('active');
    document.getElementById('addLinkName').focus();
  }

  function hideAddLinkModal() {
    document.getElementById('addLinkModalOverlay').classList.remove('active');
    addLinkContext = null;
  }

  document.getElementById('addLinkCancel')?.addEventListener('click', hideAddLinkModal);
  document.getElementById('addLinkModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'addLinkModalOverlay') hideAddLinkModal();
  });

  document.getElementById('addLinkSave')?.addEventListener('click', async () => {
    if (!addLinkContext || !window.electronAPI?.saveLink) return;

    const linkName = document.getElementById('addLinkName').value.trim();
    const linkUrl = document.getElementById('addLinkUrl').value.trim();

    if (!linkName) {
      showToast('Please enter a link name', 'error');
      return;
    }
    if (!linkUrl) {
      showToast('Please enter a URL', 'error');
      return;
    }

    // Ensure URL has protocol
    let finalUrl = linkUrl;
    if (!linkUrl.match(/^https?:\/\//i)) {
      finalUrl = 'https://' + linkUrl;
    }

    const result = await window.electronAPI.saveLink({
      ownerType: addLinkContext.ownerType,
      ownerId: addLinkContext.ownerId,
      ownerName: addLinkContext.ownerName,
      linkName: linkName,
      linkUrl: finalUrl
    });

    if (result.success) {
      showToast('Link added', 'success');
      loadAndRenderHudFiles(addLinkContext.ownerType, addLinkContext.ownerId, addLinkContext.containerId, addLinkContext.ownerName);
      hideAddLinkModal();
    } else {
      showToast('Error adding link: ' + (result.error || 'Unknown error'), 'error');
    }
  });

  // Client Add Link button handler
  document.getElementById('clientHudAddLinkBtn')?.addEventListener('click', () => {
    if (!currentClient) return;
    showAddLinkModal('client', currentClient.id, currentClient.name, 'clientHudFiles');
  });

  // Client HUD Save handler
  document.getElementById('clientHudSave')?.addEventListener('click', () => {
    if (!currentClient) return;

    const clients = loadClients();
    const idx = clients.findIndex(c => c.id === currentClient.id);
    if (idx === -1) return;

    // Update client data from form fields
    clients[idx].name = document.getElementById('clientHudNameInput').value || clients[idx].name;
    clients[idx].location = document.getElementById('clientHudLocationInput').value;
    clients[idx].email = document.getElementById('clientHudEmailInput').value;
    clients[idx].phone = document.getElementById('clientHudPhoneInput').value;
    clients[idx].preferredContact = document.getElementById('clientHudPreferredContactInput')?.value || '';
    clients[idx].business = document.getElementById('clientHudBusinessInput')?.value || '';
    clients[idx].revenue = document.getElementById('clientHudRevenueInput')?.value || '';
    clients[idx].notes = document.getElementById('clientHudNotesInput').value;
    clients[idx].hp = Math.max(0, Math.min(100, parseInt(document.getElementById('clientHudHpInput').value) || 100));
    clients[idx].photo = clientHudPhoto;

    saveClients(clients);
    renderClients();

    // Update header display
    document.getElementById('hudClientName').textContent = clients[idx].name;

    // Refresh map markers
    if (window.mapIntegration && window.mapIntegration.refreshClientMarkers) {
      window.mapIntegration.refreshClientMarkers();
    }

    console.log(`✅ Saved client: ${clients[idx].name}`);
  });

  // Expose globally for map integration
  window.showClientCard = openClientHUD;

  document.getElementById('hudClose').addEventListener('click', () => {
    document.getElementById('hudOverlay').classList.remove('active');
    currentClient = null;
  });

  // Delete client button handler
  document.getElementById('hudDelete').addEventListener('click', () => {
    if (!currentClient) return;

    showDeleteConfirm(currentClient.name, 'client', async () => {
      // Get current clients list
      const clients = loadClients();

      // Remove the client
      const updatedClients = clients.filter(c => c.id !== currentClient.id);

      // Save updated list
      saveClients(updatedClients);

      // Refresh client list display
      renderClients();

      // Refresh client markers on map if available
      if (window.mapIntegration && window.mapIntegration.refreshClientMarkers) {
        window.mapIntegration.refreshClientMarkers();
      }

      // Delete the client's file folder from disk
      if (window.electronAPI?.deleteOwnerFolder) {
        try {
          await window.electronAPI.deleteOwnerFolder({
            ownerType: 'client',
            ownerId: currentClient.id,
            ownerName: currentClient.name
          });
          console.log(`🗑️ Deleted client folder for: ${currentClient.name}`);
        } catch (e) {
          console.error('Error deleting client folder:', e);
        }
      }

      // Close HUD
      const deletedClientName = currentClient.name;
      document.getElementById('hudOverlay').classList.remove('active');
      currentClient = null;

      console.log(`✅ Deleted client: ${deletedClientName}`);
    });
  });

  // Close HUD on overlay click
  document.getElementById('hudOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'hudOverlay') {
      document.getElementById('hudOverlay').classList.remove('active');
    }
  });

  // Client quick action handlers
  document.getElementById('clientCallBtn')?.addEventListener('click', () => {
    // Open Zoom app directly
    const zoomUrl = 'zoommtg://zoom.us/start?confno=new';
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(zoomUrl);
    } else {
      window.open(zoomUrl, '_blank');
    }
  });

  document.getElementById('clientEmailBtn')?.addEventListener('click', () => {
    // Switch to email view
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const emailNav = document.querySelector('.nav-item[data-view="email"]');
    if (emailNav) {
      emailNav.classList.add('active');
      document.getElementById('email')?.classList.add('active');
    }
    // Open compose modal with prefilled email
    const composeModal = document.getElementById('composeEmailModal');
    if (composeModal) {
      composeModal.classList.add('active');
      const toField = document.getElementById('emailTo');
      if (toField) toField.value = currentClient?.email || '';
      const subjectField = document.getElementById('emailSubject');
      if (subjectField) subjectField.value = '';
      const bodyField = document.getElementById('emailBody');
      if (bodyField) bodyField.value = '';
    }
  });

  // ==========================================
  // Employee HUD
  // ==========================================
  let currentEmployee = null;
  let employeeHudPhoto = null;

  function openEmployeeHUD(employee) {
    currentEmployee = employee;
    employeeHudPhoto = employee.photo || null;

    const hudOverlay = document.getElementById('employeeHudOverlay');
    document.getElementById('employeeHudName').textContent = employee.name;

    // Populate editable form fields
    document.getElementById('employeeHudNameInput').value = employee.name || '';
    document.getElementById('employeeHudLocationInput').value = employee.location || '';
    document.getElementById('employeeHudTitleInput').value = employee.title || '';
    document.getElementById('employeeHudCategoryInput').value = employee.category || 'bookkeepers';
    document.getElementById('employeeHudEmailInput').value = employee.email || '';
    document.getElementById('employeeHudPhoneInput').value = employee.phone || '';
    document.getElementById('employeeHudCompensationInput').value = employee.compensation || '';
    document.getElementById('employeeHudNotesInput').value = employee.notes || '';

    // Photo
    const photoContainer = document.getElementById('employeeHudPhoto');
    const photoRemoveBtn = document.getElementById('employeeHudPhotoRemove');
    if (employee.photo) {
      photoContainer.innerHTML = `<img src="${employee.photo}" class="hud-photo-img" alt="${employee.name}">`;
      photoRemoveBtn.style.display = 'inline-block';
    } else {
      photoContainer.innerHTML = '<div class="hud-photo-placeholder">👤</div>';
      photoRemoveBtn.style.display = 'none';
    }

    // HP Bar with editable input
    const hp = employee.hp !== undefined ? employee.hp : 100;
    const hpInput = document.getElementById('employeeHudHpInput');
    const hpBar = document.getElementById('employeeHudHpBar');
    hpInput.value = hp;
    updateHudHpBar(hpInput, hpBar);

    // Add change listener for HP input
    hpInput.oninput = () => {
      updateHudHpBar(hpInput, hpBar);
    };

    // Files - load from disk
    loadAndRenderHudFiles('employee', employee.id, 'employeeHudFiles', employee.name);

    hudOverlay.classList.add('active');
  }

  // Employee HUD Photo upload
  document.getElementById('employeeHudPhotoBtn')?.addEventListener('click', () => {
    document.getElementById('employeeHudPhotoInput').click();
  });

  document.getElementById('employeeHudPhotoInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        employeeHudPhoto = event.target.result;
        document.getElementById('employeeHudPhoto').innerHTML = `<img src="${employeeHudPhoto}" class="hud-photo-img" alt="Photo">`;
        document.getElementById('employeeHudPhotoRemove').style.display = 'inline-block';
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('employeeHudPhotoRemove')?.addEventListener('click', () => {
    employeeHudPhoto = null;
    document.getElementById('employeeHudPhoto').innerHTML = '<div class="hud-photo-placeholder">👤</div>';
    document.getElementById('employeeHudPhotoRemove').style.display = 'none';
    document.getElementById('employeeHudPhotoInput').value = '';
  });

  // Employee HUD File upload handler
  document.getElementById('employeeHudAttachBtn')?.addEventListener('click', () => {
    document.getElementById('employeeHudFileInput').click();
  });

  document.getElementById('employeeHudFileInput')?.addEventListener('change', async (e) => {
    if (!currentEmployee || !window.electronAPI?.saveFile) return;

    const files = Array.from(e.target.files);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = await window.electronAPI.saveFile({
          ownerType: 'employee',
          ownerId: currentEmployee.id,
          ownerName: currentEmployee.name,
          fileName: file.name,
          fileData: event.target.result,
          fileType: file.type,
          fileSize: file.size
        });

        if (result.success) {
          showToast(`File "${file.name}" uploaded`, 'success');
          loadAndRenderHudFiles('employee', currentEmployee.id, 'employeeHudFiles', currentEmployee.name);
        } else {
          showToast(`Error uploading ${file.name}: ${result.error || 'Unknown error'}`, 'error');
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  });

  // Employee Add Link button handler
  document.getElementById('employeeHudAddLinkBtn')?.addEventListener('click', () => {
    if (!currentEmployee) return;
    showAddLinkModal('employee', currentEmployee.id, currentEmployee.name, 'employeeHudFiles');
  });

  // Employee HUD Save handler
  document.getElementById('employeeHudSave')?.addEventListener('click', () => {
    if (!currentEmployee) return;

    const employees = loadEmployees();
    const idx = employees.findIndex(e => e.id === currentEmployee.id);
    if (idx === -1) return;

    // Update employee data from form fields
    employees[idx].name = document.getElementById('employeeHudNameInput').value || employees[idx].name;
    employees[idx].location = document.getElementById('employeeHudLocationInput').value;
    employees[idx].title = document.getElementById('employeeHudTitleInput').value;
    employees[idx].category = document.getElementById('employeeHudCategoryInput').value;
    employees[idx].email = document.getElementById('employeeHudEmailInput').value;
    employees[idx].phone = document.getElementById('employeeHudPhoneInput').value;
    employees[idx].compensation = document.getElementById('employeeHudCompensationInput').value;
    employees[idx].notes = document.getElementById('employeeHudNotesInput').value;
    employees[idx].hp = Math.max(0, Math.min(100, parseInt(document.getElementById('employeeHudHpInput').value) || 100));
    employees[idx].photo = employeeHudPhoto;

    saveEmployees(employees);
    renderEmployees();

    // Update header display
    document.getElementById('employeeHudName').textContent = employees[idx].name;

    // Refresh map markers
    if (window.mapIntegration && window.mapIntegration.refreshEmployeeMarkers) {
      window.mapIntegration.refreshEmployeeMarkers();
    }

    console.log(`✅ Saved employee: ${employees[idx].name}`);
  });

  // Expose globally for map integration
  window.showEmployeeCard = openEmployeeHUD;

  // Employee HUD close handler
  document.getElementById('employeeHudClose')?.addEventListener('click', () => {
    document.getElementById('employeeHudOverlay').classList.remove('active');
    currentEmployee = null;
  });

  // Employee HUD overlay click to close
  document.getElementById('employeeHudOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'employeeHudOverlay') {
      document.getElementById('employeeHudOverlay').classList.remove('active');
      currentEmployee = null;
    }
  });

  // Employee delete handler
  document.getElementById('employeeHudDelete')?.addEventListener('click', () => {
    if (!currentEmployee) return;

    showDeleteConfirm(currentEmployee.name, 'employee', async () => {
      const employees = loadEmployees();
      const updatedEmployees = employees.filter(e => e.id !== currentEmployee.id);
      saveEmployees(updatedEmployees);
      renderEmployees();

      // Refresh employee markers on map
      if (window.mapIntegration && window.mapIntegration.refreshEmployeeMarkers) {
        window.mapIntegration.refreshEmployeeMarkers();
      }

      // Delete the employee's file folder from disk
      if (window.electronAPI?.deleteOwnerFolder) {
        try {
          await window.electronAPI.deleteOwnerFolder({
            ownerType: 'employee',
            ownerId: currentEmployee.id,
            ownerName: currentEmployee.name
          });
          console.log(`🗑️ Deleted employee folder for: ${currentEmployee.name}`);
        } catch (e) {
          console.error('Error deleting employee folder:', e);
        }
      }

      const deletedName = currentEmployee.name;
      document.getElementById('employeeHudOverlay').classList.remove('active');
      currentEmployee = null;
      console.log(`✅ Deleted employee: ${deletedName}`);
    });
  });

  // Employee quick action handlers
  document.getElementById('employeeCallBtn')?.addEventListener('click', () => {
    // Open Zoom app directly
    const zoomUrl = 'zoommtg://zoom.us/start?confno=new';
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(zoomUrl);
    } else {
      window.open(zoomUrl, '_blank');
    }
  });

  document.getElementById('employeeEmailBtn')?.addEventListener('click', () => {
    // Switch to email view
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const emailNav = document.querySelector('.nav-item[data-view="email"]');
    if (emailNav) {
      emailNav.classList.add('active');
      document.getElementById('email')?.classList.add('active');
    }
    // Open compose modal with prefilled email
    const composeModal = document.getElementById('composeEmailModal');
    if (composeModal) {
      composeModal.classList.add('active');
      const toField = document.getElementById('emailTo');
      if (toField) toField.value = currentEmployee?.email || '';
      const subjectField = document.getElementById('emailSubject');
      if (subjectField) subjectField.value = '';
      const bodyField = document.getElementById('emailBody');
      if (bodyField) bodyField.value = '';
    }
  });

  // ==========================================
  // CRM Pipe HUD
  // ==========================================
  let currentCrmPipe = null;
  let crmPipeHudPhoto = null;

  function openCrmPipeHUD(lead) {
    currentCrmPipe = lead;
    crmPipeHudPhoto = lead.photo || null;

    const hudOverlay = document.getElementById('crmPipeHudOverlay');
    document.getElementById('crmPipeHudName').textContent = lead.name;

    // Populate editable form fields
    document.getElementById('crmPipeHudNameInput').value = lead.name || '';
    document.getElementById('crmPipeHudLocationInput').value = lead.location || '';
    document.getElementById('crmPipeHudCompanyInput').value = lead.company || '';
    document.getElementById('crmPipeHudEmailInput').value = lead.email || '';
    document.getElementById('crmPipeHudPhoneInput').value = lead.phone || '';
    document.getElementById('crmPipeHudStageInput').value = lead.stage || '1';
    document.getElementById('crmPipeHudValueInput').value = lead.value || '';
    document.getElementById('crmPipeHudNotesInput').value = lead.notes || '';

    // Photo
    const photoContainer = document.getElementById('crmPipeHudPhoto');
    const photoRemoveBtn = document.getElementById('crmPipeHudPhotoRemove');
    if (lead.photo) {
      photoContainer.innerHTML = `<img src="${lead.photo}" class="hud-photo-img" alt="${lead.name}">`;
      photoRemoveBtn.style.display = 'inline-block';
    } else {
      photoContainer.innerHTML = '<div class="hud-photo-placeholder">👤</div>';
      photoRemoveBtn.style.display = 'none';
    }

    // HP Bar with editable input
    const hp = lead.hp !== undefined ? lead.hp : 100;
    const hpInput = document.getElementById('crmPipeHudHpInput');
    const hpBar = document.getElementById('crmPipeHudHpBar');
    hpInput.value = hp;
    updateHudHpBar(hpInput, hpBar);

    // Add change listener for HP input
    hpInput.oninput = () => {
      updateHudHpBar(hpInput, hpBar);
    };

    // Files - load from disk
    loadAndRenderHudFiles('lead', lead.id, 'crmPipeHudFiles', lead.name);

    hudOverlay.classList.add('active');
  }

  // CRM Pipe HUD Photo upload
  document.getElementById('crmPipeHudPhotoBtn')?.addEventListener('click', () => {
    document.getElementById('crmPipeHudPhotoInput').click();
  });

  document.getElementById('crmPipeHudPhotoInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        crmPipeHudPhoto = event.target.result;
        document.getElementById('crmPipeHudPhoto').innerHTML = `<img src="${crmPipeHudPhoto}" class="hud-photo-img" alt="Photo">`;
        document.getElementById('crmPipeHudPhotoRemove').style.display = 'inline-block';
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('crmPipeHudPhotoRemove')?.addEventListener('click', () => {
    crmPipeHudPhoto = null;
    document.getElementById('crmPipeHudPhoto').innerHTML = '<div class="hud-photo-placeholder">👤</div>';
    document.getElementById('crmPipeHudPhotoRemove').style.display = 'none';
    document.getElementById('crmPipeHudPhotoInput').value = '';
  });

  // CRM Pipe HUD File upload handler
  document.getElementById('crmPipeHudAttachBtn')?.addEventListener('click', () => {
    document.getElementById('crmPipeHudFileInput').click();
  });

  document.getElementById('crmPipeHudFileInput')?.addEventListener('change', async (e) => {
    if (!currentCrmPipe || !window.electronAPI?.saveFile) return;

    const files = Array.from(e.target.files);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = await window.electronAPI.saveFile({
          ownerType: 'lead',
          ownerId: currentCrmPipe.id,
          ownerName: currentCrmPipe.name,
          fileName: file.name,
          fileData: event.target.result,
          fileType: file.type,
          fileSize: file.size
        });

        if (result.success) {
          showToast(`File "${file.name}" uploaded`, 'success');
          loadAndRenderHudFiles('lead', currentCrmPipe.id, 'crmPipeHudFiles', currentCrmPipe.name);
        } else {
          showToast(`Error uploading ${file.name}: ${result.error || 'Unknown error'}`, 'error');
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  });

  // CRM Pipe (Lead) Add Link button handler
  document.getElementById('crmPipeHudAddLinkBtn')?.addEventListener('click', () => {
    if (!currentCrmPipe) return;
    showAddLinkModal('lead', currentCrmPipe.id, currentCrmPipe.name, 'crmPipeHudFiles');
  });

  // CRM Pipe HUD Save handler
  document.getElementById('crmPipeHudSave')?.addEventListener('click', async () => {
    if (!currentCrmPipe) return;

    const leads = loadPipeline();
    const idx = leads.findIndex(l => l.id === currentCrmPipe.id);
    if (idx === -1) return;

    // Update lead data from form fields
    leads[idx].name = document.getElementById('crmPipeHudNameInput').value || leads[idx].name;
    leads[idx].location = document.getElementById('crmPipeHudLocationInput').value;
    leads[idx].company = document.getElementById('crmPipeHudCompanyInput').value;
    leads[idx].email = document.getElementById('crmPipeHudEmailInput').value;
    leads[idx].phone = document.getElementById('crmPipeHudPhoneInput').value;
    const newStage = parseInt(document.getElementById('crmPipeHudStageInput').value) || 1;
    leads[idx].stage = newStage;
    leads[idx].value = document.getElementById('crmPipeHudValueInput').value;
    leads[idx].notes = document.getElementById('crmPipeHudNotesInput').value;
    leads[idx].hp = Math.max(0, Math.min(100, parseInt(document.getElementById('crmPipeHudHpInput').value) || 100));
    leads[idx].photo = crmPipeHudPhoto;

    // Check if stage is 5 (SIGNED) - prompt to convert to client
    if (newStage === 5) {
      savePipeline(leads); // Save first so data is up to date
      const leadData = leads[idx];

      // Close the HUD first
      document.getElementById('crmPipeHudOverlay').classList.remove('active');
      currentCrmPipe = null;

      // Show confirmation to convert
      showConvertToClientConfirm(leadData);
      return;
    }

    savePipeline(leads);
    renderCrmPipeSidebar();
    renderPipeline();

    // Update header display
    document.getElementById('crmPipeHudName').textContent = leads[idx].name;
    showToast('Lead saved', 'success');

    console.log(`✅ Saved lead: ${leads[idx].name}`);
  });

  // Expose globally
  window.showCrmPipeCard = openCrmPipeHUD;

  // CRM Pipe HUD close handler
  document.getElementById('crmPipeHudClose')?.addEventListener('click', () => {
    document.getElementById('crmPipeHudOverlay').classList.remove('active');
    currentCrmPipe = null;
  });

  // CRM Pipe HUD overlay click to close
  document.getElementById('crmPipeHudOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'crmPipeHudOverlay') {
      document.getElementById('crmPipeHudOverlay').classList.remove('active');
      currentCrmPipe = null;
    }
  });

  // CRM Pipe delete handler
  document.getElementById('crmPipeHudDelete')?.addEventListener('click', () => {
    if (!currentCrmPipe) return;

    showDeleteConfirm(currentCrmPipe.name, 'lead', async () => {
      const leads = loadPipeline();
      const updatedLeads = leads.filter(l => l.id !== currentCrmPipe.id);
      savePipeline(updatedLeads);
      renderCrmPipeSidebar();
      renderPipeline();

      // Delete the lead's file folder from disk
      if (window.electronAPI?.deleteOwnerFolder) {
        try {
          await window.electronAPI.deleteOwnerFolder({
            ownerType: 'lead',
            ownerId: currentCrmPipe.id,
            ownerName: currentCrmPipe.name
          });
          console.log(`🗑️ Deleted lead folder for: ${currentCrmPipe.name}`);
        } catch (e) {
          console.error('Error deleting lead folder:', e);
        }
      }

      const deletedName = currentCrmPipe.name;
      document.getElementById('crmPipeHudOverlay').classList.remove('active');
      currentCrmPipe = null;
      console.log(`✅ Deleted lead: ${deletedName}`);
    });
  });

  // CRM Pipe quick action handlers
  document.getElementById('crmPipeCallBtn')?.addEventListener('click', () => {
    // Open Zoom app directly
    const zoomUrl = 'zoommtg://zoom.us/start?confno=new';
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(zoomUrl);
    } else {
      window.open(zoomUrl, '_blank');
    }
  });

  document.getElementById('crmPipeEmailBtn')?.addEventListener('click', () => {
    // Switch to email view
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const emailNav = document.querySelector('.nav-item[data-view="email"]');
    if (emailNav) {
      emailNav.classList.add('active');
      document.getElementById('email')?.classList.add('active');
    }
    // Open compose modal with prefilled email
    const composeModal = document.getElementById('composeEmailModal');
    if (composeModal) {
      composeModal.classList.add('active');
      const toField = document.getElementById('emailTo');
      if (toField) toField.value = currentCrmPipe?.email || '';
      const subjectField = document.getElementById('emailSubject');
      if (subjectField) subjectField.value = '';
      const bodyField = document.getElementById('emailBody');
      if (bodyField) bodyField.value = '';
    }
  });

  // World map functionality with Google Maps integration
  const worldMapElement = document.getElementById('worldMap');
  let mapIntegration = null;

  // Initialize Map Integration when Google Maps loads
  window.initMap = async function() {
    if (window.MapIntegration && worldMapElement) {
      mapIntegration = new MapIntegration();
      await mapIntegration.initMap(worldMapElement);
      console.log('✅ Map Integration ready');

      // Load client markers
      await mapIntegration.refreshClientMarkers();
      // Load employee markers
      await mapIntegration.refreshEmployeeMarkers();
    }
  };

  // Expose mapIntegration globally for refreshing markers
  window.mapIntegration = null;
  Object.defineProperty(window, 'mapIntegration', {
    get: () => mapIntegration,
    set: (val) => { mapIntegration = val; }
  });

  // Update map when viewing map page
  const mapNavBtn = document.querySelector('[data-view="map"]');
  if (mapNavBtn) {
    mapNavBtn.addEventListener('click', async () => {
      setTimeout(async () => {
        // Initialize map if not already done
        if (!mapIntegration && window.google) {
          await window.initMap();
        }

        // Auto calendar flight import disabled - flights only added on save or manual input
        // mapIntegration.loadCalendarFlights removed to prevent API rate limiting
      }, 100);
    });
  }

  // Note: Flight API auto-refresh has been removed - flights are static pins only

  // Live Status button handler
  const liveStatusBtn = document.getElementById('liveStatusBtn');
  if (liveStatusBtn) {
    liveStatusBtn.addEventListener('click', () => {
      const url = 'https://www.flightaware.com';
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(url);
      } else {
        window.open(url, '_blank');
      }
    });
  }

  // Flight input handlers
  const trackFlightBtn = document.getElementById('trackFlightBtn');
  const clearFlightsBtn = document.getElementById('clearFlightsBtn');
  const flightNumberInput = document.getElementById('flightNumberInput');
  const flightRouteInput = document.getElementById('flightRouteInput');
  const flightDepartureInput = document.getElementById('flightDepartureInput');
  const flightArrivalInput = document.getElementById('flightArrivalInput');

  if (trackFlightBtn) {
    trackFlightBtn.addEventListener('click', async () => {
      console.log('Track Flight button clicked');

      if (!mapIntegration) {
        console.error('Map not initialized');
        await showConfirmModal({
          icon: '✈️',
          title: 'Map Not Ready',
          message: 'Please open the WORLD MAP view first, then try again.',
          confirmText: 'OK',
          cancelText: null,
          type: 'warning'
        });
        return;
      }

      const flightNumber = flightNumberInput?.value.trim() || '';
      const route = flightRouteInput?.value.trim() || '';
      const departureTime = flightDepartureInput?.value || null;
      const arrivalTime = flightArrivalInput?.value || null;

      console.log('Flight input:', { flightNumber, route, departureTime, arrivalTime });

      if (!route) {
        await showConfirmModal({
          icon: '✈️',
          title: 'Route Required',
          message: 'Please enter a route (e.g., New York to Los Angeles or JFK → LAX)',
          confirmText: 'OK',
          cancelText: null,
          type: 'warning'
        });
        return;
      }

      try {
        // Use addFlightFromInput which supports city names
        const result = await mapIntegration.addFlightFromInput({
          flightNumber: flightNumber || null,
          routeString: route,
          departureTime: departureTime ? new Date(departureTime).toISOString() : null,
          arrivalTime: arrivalTime ? new Date(arrivalTime).toISOString() : null
        });

        if (result) {
          console.log('Flight added successfully');
          showToast('Flight added to tracker', 'success');

          // Clear inputs
          if (flightNumberInput) flightNumberInput.value = '';
          if (flightRouteInput) flightRouteInput.value = '';
          if (flightDepartureInput) flightDepartureInput.value = '';
          if (flightArrivalInput) flightArrivalInput.value = '';
        }
      } catch (error) {
        console.error('Error adding flight:', error);
        await showConfirmModal({
          icon: '❌',
          title: 'Error Adding Flight',
          message: error.message || 'An unknown error occurred',
          confirmText: 'OK',
          cancelText: null,
          type: 'danger'
        });
      }
    });
    console.log('Track Flight button handler attached');
  }

  if (clearFlightsBtn) {
    clearFlightsBtn.addEventListener('click', async () => {
      if (mapIntegration) {
        const confirmed = await showConfirmModal({
          icon: '✈️',
          title: 'Clear All Flights',
          message: 'Are you sure you want to remove all tracked flights?',
          confirmText: 'Clear All',
          cancelText: 'Cancel',
          type: 'danger'
        });

        if (confirmed) {
          mapIntegration.clearAllFlights();
          showToast('All flights cleared', 'success');
        }
      }
    });
  }

  // Allow Enter key to submit
  [flightNumberInput, flightRouteInput].forEach(input => {
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          trackFlightBtn.click();
        }
      });
    }
  });

  // Add Client Modal
  const addClientBtn = document.getElementById('addClientBtn');
  const addClientModal = document.getElementById('addClientModal');
  const closeAddClientModal = document.getElementById('closeAddClientModal');
  const saveClientBtn = document.getElementById('saveClient');

  let selectedClientColor = '#3788d8';

  function resetClientForm() {
    document.getElementById('clientName').value = '';
    document.getElementById('clientLocation').value = '';
    const clientEmailEl = document.getElementById('clientEmail');
    const clientPhoneEl = document.getElementById('clientPhone');
    const clientNotesEl = document.getElementById('clientNotes');
    const clientPreferredContactEl = document.getElementById('clientPreferredContact');
    const clientBusinessEl = document.getElementById('clientBusiness');
    const clientRevenueEl = document.getElementById('clientRevenue');
    if (clientEmailEl) clientEmailEl.value = '';
    if (clientPhoneEl) clientPhoneEl.value = '';
    if (clientPreferredContactEl) clientPreferredContactEl.value = '';
    if (clientBusinessEl) clientBusinessEl.value = '';
    if (clientRevenueEl) clientRevenueEl.value = '';
    if (clientNotesEl) clientNotesEl.value = '';
    selectedClientColor = '#3788d8';
    updateColorSelection(addClientModal, selectedClientColor);
    clientPhotoData = null;
    clientFilesData = [];
    if (clientPhotoPreview) clientPhotoPreview.innerHTML = '<span class="photo-preview-placeholder">👤</span>';
    if (clientPhotoRemove) clientPhotoRemove.style.display = 'none';
    renderClientFilesList();
    resetHpBar('clientHpCurrent', 'clientHpBar');
  }

  // Initialize client HP bar
  updateHpBar('clientHpCurrent', 'clientHpBar');

  addClientBtn.addEventListener('click', () => {
    resetClientForm();
    addClientModal.classList.add('active');
  });

  closeAddClientModal.addEventListener('click', () => {
    addClientModal.classList.remove('active');
  });

  // Color picker in add client modal
  addClientModal.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedClientColor = btn.dataset.color;
      updateColorSelection(addClientModal, selectedClientColor);
    });
  });

  function updateColorSelection(modal, color) {
    modal.querySelectorAll('.color-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.color === color);
    });
  }

  // Client photo and file handling
  let clientPhotoData = null;
  let clientFilesData = [];

  const clientPhotoBtn = document.getElementById('clientPhotoBtn');
  const clientPhotoInput = document.getElementById('clientPhotoInput');
  const clientPhotoPreview = document.getElementById('clientPhotoPreview');
  const clientPhotoRemove = document.getElementById('clientPhotoRemove');
  const clientAttachBtn = document.getElementById('clientAttachBtn');
  const clientFileInput = document.getElementById('clientFileInput');
  const clientFilesList = document.getElementById('clientFilesList');

  if (clientPhotoBtn) {
    clientPhotoBtn.addEventListener('click', () => clientPhotoInput.click());
  }

  if (clientPhotoInput) {
    clientPhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          clientPhotoData = e.target.result;
          clientPhotoPreview.innerHTML = `<img src="${clientPhotoData}" alt="Photo">`;
          clientPhotoRemove.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (clientPhotoRemove) {
    clientPhotoRemove.addEventListener('click', () => {
      clientPhotoData = null;
      clientPhotoPreview.innerHTML = '<span class="photo-preview-placeholder">👤</span>';
      clientPhotoRemove.style.display = 'none';
      clientPhotoInput.value = '';
    });
  }

  if (clientAttachBtn) {
    clientAttachBtn.addEventListener('click', () => clientFileInput.click());
  }

  if (clientFileInput) {
    clientFileInput.addEventListener('change', (e) => {
      Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          clientFilesData.push({
            name: file.name,
            size: file.size,
            type: file.type,
            data: ev.target.result,
            uploadDate: new Date().toISOString()
          });
          renderClientFilesList();
        };
        reader.readAsDataURL(file);
      });
      clientFileInput.value = '';
    });
  }

  function renderClientFilesList() {
    if (!clientFilesList) return;
    if (clientFilesData.length === 0) {
      clientFilesList.innerHTML = '<div class="no-files-message">No files attached</div>';
      return;
    }
    clientFilesList.innerHTML = clientFilesData.map((file, idx) => `
      <div class="file-attachment-item">
        <span class="file-attachment-icon">${getFileIcon(file.type)}</span>
        <span class="file-attachment-name">${file.name}</span>
        <span class="file-attachment-size">${formatFileSize(file.size)}</span>
        <button class="file-attachment-remove" data-idx="${idx}">✕</button>
      </div>
    `).join('');

    clientFilesList.querySelectorAll('.file-attachment-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        clientFilesData.splice(parseInt(btn.dataset.idx), 1);
        renderClientFilesList();
      });
    });
  }

  saveClientBtn.addEventListener('click', () => {
    const name = document.getElementById('clientName').value.trim();
    const location = document.getElementById('clientLocation').value.trim();

    if (!name || !location) {
      alert('Please fill in all fields');
      return;
    }

    const clients = loadClients();
    const newClient = {
      id: Date.now().toString(),
      name: name,
      location: location,
      email: document.getElementById('clientEmail')?.value.trim() || '',
      phone: document.getElementById('clientPhone')?.value.trim() || '',
      preferredContact: document.getElementById('clientPreferredContact')?.value || '',
      business: document.getElementById('clientBusiness')?.value.trim() || '',
      revenue: document.getElementById('clientRevenue')?.value.trim() || '',
      color: selectedClientColor,
      status: 'Active',
      notes: document.getElementById('clientNotes')?.value.trim() || '',
      photo: clientPhotoData,
      files: clientFilesData,
      hp: parseInt(document.getElementById('clientHpCurrent')?.value) || 100
    };

    clients.push(newClient);
    saveClients(clients);
    renderClients();

    // Create folder for client and save card info
    if (window.electronAPI?.createCardFolder) {
      window.electronAPI.createCardFolder({
        ownerType: 'client',
        ownerId: newClient.id,
        ownerName: newClient.name,
        cardData: {
          email: newClient.email,
          phone: newClient.phone,
          preferredContact: newClient.preferredContact,
          business: newClient.business,
          revenue: newClient.revenue,
          location: newClient.location,
          status: newClient.status,
          notes: newClient.notes,
          color: newClient.color,
          photo: newClient.photo
        }
      }).then(result => {
        if (result.success) {
          console.log(`✅ Created folder for client: ${newClient.name}`);
        }
      }).catch(err => console.error('Error creating client folder:', err));
    }

    // Reset form
    clientPhotoData = null;
    clientFilesData = [];
    if (clientPhotoPreview) clientPhotoPreview.innerHTML = '<span class="photo-preview-placeholder">👤</span>';
    if (clientPhotoRemove) clientPhotoRemove.style.display = 'none';
    renderClientFilesList();

    addClientModal.classList.remove('active');
  });

  // View full calendar button
  document.getElementById('viewFullCalendarBtn').addEventListener('click', () => {
    document.querySelector('[data-view="calendar"]').click();
  });

  // LinkedIn Panel - Quick Launch Buttons (opens in browser)
  const linkedinLaunchBtns = document.querySelectorAll('.linkedin-launch-btn');

  // Quick launch button click handlers - open in external browser
  linkedinLaunchBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      console.log('LinkedIn quick launch clicked:', url);
      if (url) {
        if (window.electronAPI?.openExternal) {
          window.electronAPI.openExternal(url);
        } else {
          window.open(url, '_blank');
        }
      }
    });
  });

  // Update today's schedule from calendar events
  function updateTodaysSchedule() {
    const events = loadEvents();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Filter events for today
    const todaysEvents = events.filter(event => {
      const eventStart = new Date(event.start);
      return eventStart >= today && eventStart < tomorrow;
    }).sort((a, b) => new Date(a.start) - new Date(b.start));

    // Update the calendar preview panel
    const calendarPreview = document.getElementById('calendarPreview');
    if (todaysEvents.length === 0) {
      calendarPreview.innerHTML = `
        <div class="calendar-event">
          <div class="event-title">No events scheduled for today</div>
        </div>
      `;
    } else {
      calendarPreview.innerHTML = todaysEvents.map(event => {
        const startTime = new Date(event.start);
        const endTime = event.end ? new Date(event.end) : new Date(startTime.getTime() + 60 * 60 * 1000);
        const timeFormat = { hour: '2-digit', minute: '2-digit', hour12: false };

        return `
          <div class="calendar-event" data-event-id="${event.id}">
            <div class="event-time">${startTime.toLocaleTimeString('en-US', timeFormat)} - ${endTime.toLocaleTimeString('en-US', timeFormat)}</div>
            <div class="event-title">${event.title}</div>
            ${event.extendedProps?.location ? `<div class="event-client">${event.extendedProps.location}</div>` : ''}
          </div>
        `;
      }).join('');
    }
  }

  // Update today's schedule on load
  updateTodaysSchedule();

  // Update today's schedule every minute
  setInterval(updateTodaysSchedule, 60000);

  // AI Chat functionality
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const clearChatBtn = document.getElementById('clearChatBtn');

  function addChatMessage(text, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isUser ? 'user' : 'assistant'}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    if (isUser) {
      avatar.textContent = '👤';
    } else {
      const img = document.createElement('img');
      img.src = 'Assets/Admiral.png';
      img.className = 'admiral-avatar';
      img.alt = 'Admiral';
      avatar.appendChild(img);
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = text;

    bubble.appendChild(messageText);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(bubble);
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Add user message
    addChatMessage(message, true);
    chatInput.value = '';

    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message assistant typing-indicator';
    typingDiv.innerHTML = '<div class="message-avatar"><img src="Assets/Admiral.png" class="admiral-avatar" alt="Admiral"></div><div class="message-bubble"><div class="message-text">Thinking...</div></div>';
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      // Call Claude API
      const response = await window.ClaudeAPI.call(message);

      // Remove typing indicator
      typingDiv.remove();

      // Add AI response
      addChatMessage(response);

    } catch (error) {
      // Remove typing indicator
      typingDiv.remove();

      // Show error
      addChatMessage(`❌ Error: ${error.message}\n\nCheck:\n- API key in .env file is valid\n- You have API credits at console.anthropic.com\n- Internet connection`);
      console.error('Claude API Error:', error);
    }
  }

  chatSendBtn.addEventListener('click', sendChatMessage);

  chatInput.addEventListener('keydown', (e) => {
    // Enter sends message, Shift+Enter adds new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // Chat Upload button - triggers the same file input as Files section's "Add File" button
  const chatUploadBtn = document.getElementById('chatUploadBtn');
  if (chatUploadBtn) {
    chatUploadBtn.addEventListener('click', () => {
      // Use the existing misc file input from the Files section
      const miscFileInput = document.getElementById('miscFileInput');
      if (miscFileInput) {
        miscFileInput.click();
      } else {
        addChatMessage('❌ File upload not available. Go to Files section to add files.');
      }
    });
  }

  // Read Emails button - scrapes emails and adds to AI context
  const readEmailsBtn = document.getElementById('readEmailsBtn');
  if (readEmailsBtn) {
    readEmailsBtn.addEventListener('click', async () => {
      readEmailsBtn.disabled = true;
      readEmailsBtn.textContent = '⏳ Loading...';

      try {
        // Step 1: Get list of 10 most recent email IDs
        const listResponse = await fetch('http://localhost:3001/api/gmail/messages?labelIds=INBOX&maxResults=10');
        const listData = await listResponse.json();

        if (!listData.success || !listData.messages || listData.messages.length === 0) {
          throw new Error('No emails found. Make sure you are logged into Gmail.');
        }

        // Step 2: Fetch FULL content for each email individually
        readEmailsBtn.textContent = '⏳ Fetching...';
        const fullEmails = [];
        for (let i = 0; i < listData.messages.length; i++) {
          const msg = listData.messages[i];
          try {
            const detailResponse = await fetch(`http://localhost:3001/api/gmail/messages/${msg.id}`);
            const detailData = await detailResponse.json();
            if (detailData.success) {
              fullEmails.push(detailData);
            } else {
              fullEmails.push(msg); // Fallback to list data if detail fetch fails
            }
          } catch (e) {
            fullEmails.push(msg); // Fallback
          }
        }

        // Step 3: Format emails into a readable text document with FULL content
        let emailContent = `=== EMAIL INBOX - ${fullEmails.length} MOST RECENT (FULL CONTENT) ===\n`;
        emailContent += `Generated: ${new Date().toLocaleString()}\n`;
        emailContent += `Total Emails Loaded: ${fullEmails.length}\n\n`;

        fullEmails.forEach((email, i) => {
          emailContent += `${'='.repeat(60)}\n`;
          emailContent += `EMAIL ${i + 1} of ${fullEmails.length}\n`;
          emailContent += `${'='.repeat(60)}\n`;
          emailContent += `From: ${email.from || 'Unknown'}\n`;
          emailContent += `To: ${email.to || 'Unknown'}\n`;
          emailContent += `Subject: ${email.subject || '(No Subject)'}\n`;
          emailContent += `Date: ${email.date || 'Unknown'}\n`;
          emailContent += `${'─'.repeat(60)}\n`;

          // Include FULL body content - strip HTML tags for plain text
          if (email.body) {
            // Strip HTML tags to get plain text
            const plainText = email.body
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>/gi, '\n\n')
              .replace(/<\/div>/gi, '\n')
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/\n{3,}/g, '\n\n')
              .trim();
            emailContent += `${plainText}\n`;
          } else if (email.snippet) {
            emailContent += `${email.snippet}\n`;
          } else {
            emailContent += `(No content)\n`;
          }
          emailContent += `\n`;
        });

        // Add to AI context as an uploaded file
        if (window.ClaudeAPI && window.ClaudeAPI.addFile) {
          window.ClaudeAPI.addFile({
            name: 'email_inbox.txt',
            type: 'text',
            data: emailContent
          });
        }

        // Store globally for context
        window.loadedEmails = fullEmails;

        // Visual feedback
        readEmailsBtn.classList.add('loaded');
        readEmailsBtn.textContent = '✓ EMAILS';
        showToast(`Loaded ${fullEmails.length} emails with full content`, 'success');
        addChatMessage(`📧 I've loaded your ${fullEmails.length} most recent emails with FULL content. You can now ask me about your emails!`);

      } catch (error) {
        console.error('Error loading emails:', error);
        showToast(error.message || 'Failed to load emails', 'error');
        readEmailsBtn.textContent = '📧 EMAILS';
      }

      readEmailsBtn.disabled = false;
    });
  }

  // Read Calendar button - scrapes calendar events and adds to AI context
  const readCalendarBtn = document.getElementById('readCalendarBtn');
  if (readCalendarBtn) {
    readCalendarBtn.addEventListener('click', async () => {
      readCalendarBtn.disabled = true;
      readCalendarBtn.textContent = '⏳ Loading...';

      try {
        // Get events from localStorage (already loaded in app)
        const storedEvents = localStorage.getItem('calendar_events');
        let events = [];

        if (storedEvents) {
          events = JSON.parse(storedEvents);
        }

        if (events.length === 0) {
          throw new Error('No calendar events found. Add events to your calendar first.');
        }

        // Format calendar events into a readable text document
        let calendarContent = `=== CALENDAR EVENTS ===\n`;
        calendarContent += `Generated: ${new Date().toLocaleString()}\n`;
        calendarContent += `Total Events: ${events.length}\n\n`;

        // Sort events by start date
        events.sort((a, b) => new Date(a.start) - new Date(b.start));

        events.forEach((evt, i) => {
          const startDate = new Date(evt.start);
          const endDate = evt.end ? new Date(evt.end) : null;

          calendarContent += `--- EVENT ${i + 1} ---\n`;
          calendarContent += `Title: ${evt.title || 'Untitled'}\n`;
          calendarContent += `Start: ${startDate.toLocaleString()}\n`;
          if (endDate) {
            calendarContent += `End: ${endDate.toLocaleString()}\n`;
          }
          if (evt.allDay) {
            calendarContent += `All Day: Yes\n`;
          }
          if (evt.extendedProps?.location) {
            calendarContent += `Location: ${evt.extendedProps.location}\n`;
          }
          if (evt.extendedProps?.notes) {
            calendarContent += `Notes: ${evt.extendedProps.notes}\n`;
          }
          if (evt.extendedProps?.calendarName) {
            calendarContent += `Calendar: ${evt.extendedProps.calendarName}\n`;
          }
          calendarContent += `\n`;
        });

        // Add to AI context as an uploaded file
        if (window.ClaudeAPI && window.ClaudeAPI.addFile) {
          window.ClaudeAPI.addFile({
            name: 'calendar_events.txt',
            type: 'text',
            data: calendarContent
          });
        }

        // Store globally for context
        window.loadedCalendarEvents = events;

        // Visual feedback
        readCalendarBtn.classList.add('loaded');
        readCalendarBtn.textContent = '✓ CALENDAR';
        showToast(`Loaded ${events.length} calendar events into AI context`, 'success');
        addChatMessage(`📅 I've loaded ${events.length} calendar events. You can now ask me about your schedule!`);

      } catch (error) {
        console.error('Error loading calendar:', error);
        showToast(error.message || 'Failed to load calendar', 'error');
        readCalendarBtn.textContent = '📅 CALENDAR';
      }

      readCalendarBtn.disabled = false;
    });
  }

  clearChatBtn.addEventListener('click', () => {
    // Keep only the welcome message
    const welcomeMessage = chatMessages.querySelector('.chat-message.assistant');
    chatMessages.innerHTML = '';
    if (welcomeMessage) {
      chatMessages.appendChild(welcomeMessage.cloneNode(true));
    }
    // Clear uploaded files
    uploadedFiles = [];
    // Clear ClaudeAPI conversation history and files
    if (window.ClaudeAPI && window.ClaudeAPI.clearHistory) {
      window.ClaudeAPI.clearHistory();
    }
    // Reset context buttons
    const readEmailsBtn = document.getElementById('readEmailsBtn');
    const readCalendarBtn = document.getElementById('readCalendarBtn');
    if (readEmailsBtn) {
      readEmailsBtn.classList.remove('loaded');
      readEmailsBtn.textContent = '📧 EMAILS';
    }
    if (readCalendarBtn) {
      readCalendarBtn.classList.remove('loaded');
      readCalendarBtn.textContent = '📅 CALENDAR';
    }
    // Clear global context
    window.loadedEmails = null;
    window.loadedCalendarEvents = null;
  });

  // Call Center functionality
  let selectedCallPlatform = 'zoom';

  // Platform selection (including record/transcribe)
  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const platform = btn.dataset.platform;
      if (platform) {
        // Update selected platform for calls
        document.querySelectorAll('.platform-btn[data-platform]').forEach(b => {
          b.style.background = 'rgba(0, 255, 65, 0.05)';
          b.style.borderColor = 'rgba(0, 255, 65, 0.3)';
        });
        btn.style.background = 'rgba(0, 255, 65, 0.2)';
        btn.style.borderColor = '#00ff41';
        selectedCallPlatform = platform;
        console.log('Selected platform:', platform);
      }
    });
  });

  // Direct handler for Audio Call button (fallback if module not loaded)
  const audioCallBtn = document.getElementById('startAudioCall');
  console.log('Audio call button found:', !!audioCallBtn);
  if (audioCallBtn) {
    audioCallBtn.addEventListener('click', () => {
      console.log('Audio call button clicked');
      const zoomUrl = 'zoommtg://zoom.us/start?confno=new';
      console.log('Opening Zoom app:', zoomUrl);
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(zoomUrl);
      } else {
        window.open(zoomUrl, '_blank');
      }
    });
  }

  // Direct handler for Record button
  let isRecording = false;
  let mediaRecorder = null;
  let audioChunks = [];
  const recordBtn = document.getElementById('recordBtn');
  const recordIcon = document.getElementById('recordIcon');
  const recordText = document.getElementById('recordText');

  if (recordBtn) {
    recordBtn.addEventListener('click', async () => {
      console.log('Record button clicked, isRecording:', isRecording);

      if (isRecording) {
        // Stop recording
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        isRecording = false;
        if (recordIcon) recordIcon.textContent = '⏺️';
        if (recordText) recordText.textContent = 'Record';
        recordBtn.classList.remove('recording');
      } else {
        // Start recording
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];

          // Show recording status in panel
          const liveTranscriptEl = document.getElementById('liveTranscript');
          if (liveTranscriptEl) {
            liveTranscriptEl.innerHTML = `
              <span style="color: #00ff41;">🔴 Recording...</span>
              <p style="font-size: 11px; margin-top: 8px; opacity: 0.7;">
                Audio is being recorded.<br>
                Use "Transcribe" button after stopping to transcribe with Whisper AI.
              </p>
            `;
          }

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              audioChunks.push(e.data);
            }
          };

          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `recording_${timestamp}.webm`;

            // Convert to base64 and save audio
            const reader = new FileReader();
            reader.onloadend = async () => {
              if (window.electronAPI?.saveFile) {
                await window.electronAPI.saveFile({
                  fileName: fileName,
                  fileData: reader.result,
                  fileType: 'audio/webm',
                  fileSize: audioBlob.size,
                  ownerType: 'transcription',
                  ownerId: 'audio-recordings',
                  ownerName: 'Audio Recordings'
                });
                console.log('✅ Recording saved:', fileName);
                showToast('Recording saved! Use Transcribe to convert to text.', 'success');
              }
            };
            reader.readAsDataURL(audioBlob);

            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());

            // Update panel to show transcription is available
            const liveTranscriptEl = document.getElementById('liveTranscript');
            if (liveTranscriptEl) {
              liveTranscriptEl.innerHTML = `
                <span style="color: #00ff41;">✅ Recording saved!</span>
                <p style="font-size: 11px; margin-top: 8px; opacity: 0.7;">
                  Click "Transcribe" on any recording to convert it to text using Whisper AI.
                </p>
              `;
            }
          };

          mediaRecorder.start();
          isRecording = true;
          if (recordIcon) recordIcon.textContent = '⏹️';
          if (recordText) recordText.textContent = 'Stop';
          recordBtn.classList.add('recording');
          console.log('✅ Recording started');

          // Show live transcription panel
          showLiveTranscriptionPanel();
        } catch (error) {
          console.error('❌ Failed to start recording:', error);
          alert('Could not access microphone. Please allow microphone access.');
        }
      }
    });
  }

  // Show recording status panel during recording
  function showLiveTranscriptionPanel() {
    // Remove existing panel if any
    const existingPanel = document.getElementById('liveTranscriptionPanel');
    if (existingPanel) existingPanel.remove();

    const panel = document.createElement('div');
    panel.id = 'liveTranscriptionPanel';
    panel.innerHTML = `
      <div style="position: fixed; bottom: 20px; right: 20px; width: 400px; max-height: 300px;
                  background: rgba(0, 20, 10, 0.95); border: 1px solid #00ff41; border-radius: 8px;
                  padding: 15px; z-index: 10000; font-family: monospace;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="color: #00ff41; font-weight: bold;">
            <span style="animation: blink 1s infinite;">🔴</span> Recording
          </span>
          <button id="closeLivePanel" style="background: none; border: none; color: #00ff41; cursor: pointer; font-size: 18px;">×</button>
        </div>
        <div id="liveTranscript" style="color: #00cc33; font-size: 14px; max-height: 200px; overflow-y: auto;
                                         line-height: 1.5; white-space: pre-wrap; word-wrap: break-word;">
          Recording audio... Use "Transcribe" button after stopping to convert to text.
        </div>
      </div>
      <style>
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0.3; } }
      </style>
    `;
    document.body.appendChild(panel);

    document.getElementById('closeLivePanel').addEventListener('click', () => {
      panel.remove();
    });

    // Auto-remove when recording stops
    const checkRecording = setInterval(() => {
      if (!isRecording) {
        clearInterval(checkRecording);
        setTimeout(() => panel.remove(), 3000); // Keep visible for 3s after stop
      }
    }, 500);
  }

  // Transcribe functionality
  let selectedRecordingForTranscribe = null;
  const transcribeModal = document.getElementById('transcribeModal');
  const recordingsListModal = document.getElementById('recordingsListModal');
  const startTranscribeBtn = document.getElementById('startTranscribeBtn');
  const closeTranscribeModal = document.getElementById('closeTranscribeModal');
  const saveTranscriptionBtn = document.getElementById('saveTranscriptionBtn');
  const transcriptionResult = document.getElementById('transcriptionResult');
  const transcriptionText = document.getElementById('transcriptionText');

  // Load recordings into the transcribe modal
  async function loadRecordingsForTranscribe() {
    if (!recordingsListModal) return;

    // Get all files and filter for audio recordings
    let recordings = [];
    if (window.electronAPI?.getAllFiles) {
      try {
        const result = await window.electronAPI.getAllFiles();
        if (result.success && result.files) {
          recordings = result.files.filter(f =>
            f.name.endsWith('.webm') ||
            f.name.endsWith('.mp3') ||
            f.name.endsWith('.wav') ||
            f.name.endsWith('.m4a')
          );
        }
      } catch (err) {
        console.error('Error loading recordings:', err);
      }
    }

    if (recordings.length === 0) {
      recordingsListModal.innerHTML = '<div class="no-recordings-message" style="color: #00cc33; padding: 20px; text-align: center;">No recordings found. Use the Record button to create audio recordings.</div>';
      if (startTranscribeBtn) startTranscribeBtn.disabled = true;
      return;
    }

    // Render recordings list
    recordingsListModal.innerHTML = recordings.map((rec, i) => `
      <div class="recording-item" data-index="${i}" data-path="${rec.path}" style="padding: 10px; margin: 5px 0; border: 1px solid #00ff41; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <span>🎙️ ${rec.name}</span>
        <span style="color: #00cc33; font-size: 12px;">${rec.ownerName || 'Unknown'}</span>
      </div>
    `).join('');

    // Add click handlers to select recording
    recordingsListModal.querySelectorAll('.recording-item').forEach(item => {
      item.addEventListener('click', () => {
        // Deselect all
        recordingsListModal.querySelectorAll('.recording-item').forEach(el => {
          el.style.background = 'transparent';
        });
        // Select this one
        item.style.background = 'rgba(0, 255, 65, 0.2)';
        selectedRecordingForTranscribe = {
          path: item.dataset.path,
          name: recordings[parseInt(item.dataset.index)].name
        };
        if (startTranscribeBtn) startTranscribeBtn.disabled = false;
      });
    });
  }

  // Direct handler for Transcribe button
  const transcribeBtn = document.getElementById('transcribeBtn');
  if (transcribeBtn) {
    transcribeBtn.addEventListener('click', async () => {
      console.log('Transcribe button clicked');
      if (transcribeModal) {
        transcribeModal.classList.add('active');
        // Reset state
        selectedRecordingForTranscribe = null;
        if (startTranscribeBtn) startTranscribeBtn.disabled = true;
        if (transcriptionResult) transcriptionResult.style.display = 'none';
        // Load recordings
        await loadRecordingsForTranscribe();
      }
    });
  }

  // Start transcription using Whisper.cpp (native, offline, via Electron IPC)
  if (startTranscribeBtn) {
    startTranscribeBtn.addEventListener('click', async () => {
      if (!selectedRecordingForTranscribe) return;

      startTranscribeBtn.textContent = 'Transcribing...';
      startTranscribeBtn.disabled = true;

      try {
        // Check whisper status first
        if (window.electronAPI?.getWhisperStatus) {
          const status = await window.electronAPI.getWhisperStatus();
          if (!status.initialized) {
            if (!status.modelExists) {
              throw new Error('Whisper model not found. Please ensure the model file exists.');
            }
            throw new Error('Whisper not initialized');
          }
        }

        // Show progress in transcription text
        if (transcriptionText) {
          transcriptionText.innerHTML = `
            <p style="color: #00ff41;">Transcribing audio...</p>
            <p style="font-size: 12px; opacity: 0.7; margin-top: 5px;">This may take a moment for longer recordings</p>
          `;
          if (transcriptionResult) transcriptionResult.style.display = 'block';
        }

        // Get the audio file path
        const audioPath = selectedRecordingForTranscribe.path;

        // Transcribe using Whisper.cpp via IPC
        const result = await window.electronAPI.transcribeAudioFile(audioPath);

        if (result.success && result.text) {
          // Ensure text is a string before using trim
          const transcribedText = typeof result.text === 'string' ? result.text.trim() : String(result.text || '');
          transcriptionText.textContent = transcribedText || '(No speech detected)';
          if (transcriptionResult) transcriptionResult.style.display = 'block';
          showToast('Transcription complete!', 'success');
        } else {
          throw new Error(result.error || 'No transcription result');
        }
      } catch (error) {
        console.error('Transcription error:', error);
        if (transcriptionText) {
          transcriptionText.innerHTML = `
            <p style="color: #ff6b6b; margin-bottom: 15px;">⚠️ ${error.message || 'Transcription failed'}</p>
            <p style="margin-top: 10px; font-size: 12px; opacity: 0.7;">
              Ensure the whisper model is properly installed.
            </p>
          `;
          if (transcriptionResult) transcriptionResult.style.display = 'block';
        }
      }

      startTranscribeBtn.textContent = 'Start Transcription';
      startTranscribeBtn.disabled = false;
    });
  }

  // Close transcribe modal
  if (closeTranscribeModal) {
    closeTranscribeModal.addEventListener('click', () => {
      if (transcribeModal) transcribeModal.classList.remove('active');
    });
  }

  // Save transcription
  if (saveTranscriptionBtn) {
    saveTranscriptionBtn.addEventListener('click', async () => {
      const text = transcriptionText?.textContent || '';
      if (!text) return;

      // Save as file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `transcription_${timestamp}.txt`;

      if (window.electronAPI?.saveFile) {
        const blob = new Blob([text], { type: 'text/plain' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          await window.electronAPI.saveFile({
            fileName: fileName,
            fileData: reader.result,
            fileType: 'text/plain',
            fileSize: blob.size,
            ownerType: 'misc',
            ownerId: 'transcriptions',
            ownerName: 'Transcriptions'
          });
          showToast('Transcription saved!', 'success');
        };
        reader.readAsDataURL(blob);
      } else {
        // Fallback: download
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  // Close transcribe modal on outside click
  if (transcribeModal) {
    transcribeModal.addEventListener('click', (e) => {
      if (e.target === transcribeModal) {
        transcribeModal.classList.remove('active');
      }
    });
  }

  // Call Center Module initialization (for other features)
  let callCenter = null;

  async function initializeCallCenter() {
    try {
      if (window.CallCenterModule) {
        callCenter = await CallCenterModule.create('#dashboard-view', {});
        console.log('✅ Call Center Module initialized');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Call Center:', error);
    }
  }

  // Initialize Call Center after DOM is ready
  initializeCallCenter();

  // Initialize clients
  renderClients();

  // Calendar Integration
  let dayCalendar = null;
  let monthCalendar = null;
  let selectedCalendarDate = null;  // Track selected date for highlighting

  function loadEvents() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const events = JSON.parse(stored);
        // Store events globally for AI assistant access
        window.loadedCalendarEvents = events;
        return events;
      } catch (e) {
        console.error('Failed to parse stored events:', e);
        return [];
      }
    }
    return [];
  }

  function saveEvents() {
    if (!dayCalendar) return;
    const events = dayCalendar.getEvents().map(event => ({
      id: event.id,
      title: event.title,
      start: event.start.toISOString(),
      end: event.end ? event.end.toISOString() : null,
      allDay: event.allDay,
      backgroundColor: event.backgroundColor || event.extendedProps?.color || '#3788d8',
      borderColor: event.borderColor || event.backgroundColor || '#3788d8',
      extendedProps: {
        ...event.extendedProps,
        notes: event.extendedProps?.notes || ''
      }
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    // Update global variable for AI assistant access
    window.loadedCalendarEvents = events;

    // Update today's schedule when events change
    updateTodaysSchedule();

    // Update flight tracking if on map view
    if (flightTracker && document.getElementById('map-view').classList.contains('active')) {
      const allEvents = loadEvents();
      flightTracker.renderFlightsOnMap(allEvents, worldMapElement);
    }
  }

  function generateId() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function formatDateTimeLocal(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  let selectedColor = '#3788d8';
  let editingEventId = null;

  function initializeCalendars() {
    if (window.calendarsInitialized) return;

    console.log('📅 Initializing calendars...');
    const dayCalendarEl = document.getElementById('dayCalendar');
    const monthCalendarEl = document.getElementById('monthCalendar');
    console.log('   Day calendar element:', dayCalendarEl ? 'found' : 'NOT FOUND');
    console.log('   Month calendar element:', monthCalendarEl ? 'found' : 'NOT FOUND');

    if (!dayCalendarEl || !monthCalendarEl) {
      console.error('❌ Calendar elements not found in DOM');
      return;
    }

    if (typeof FullCalendar === 'undefined') {
      console.error('❌ FullCalendar library not loaded');
      return;
    }

    const events = loadEvents();
    console.log('   Loaded events:', events.length);

    // Day Calendar
    dayCalendar = new FullCalendar.Calendar(dayCalendarEl, {
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
      select: function (info) {
        openEventModal(null, info.start, info.end);
        dayCalendar.unselect();
      },
      eventClick: function (info) {
        openEventModal(info.event);
      },
      eventDrop: saveEvents,
      eventResize: saveEvents
    });

    // Month Calendar
    monthCalendar = new FullCalendar.Calendar(monthCalendarEl, {
      initialView: 'dayGridMonth',
      initialDate: new Date(),
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek'
      },
      height: '100%',
      events: events,
      firstDay: 0,
      selectable: false,  // Disable selection on month view - clicking should only navigate
      editable: true,
      eventClick: function (info) {
        openEventModal(info.event);
      },
      dateClick: function (info) {
        // Just navigate to the day - use Add Event button to create new events
        dayCalendar.gotoDate(info.date);

        // Update selected date highlighting
        selectedCalendarDate = info.dateStr;

        // Remove previous highlighting
        document.querySelectorAll('.fc-daygrid-day.selected-day').forEach(el => {
          el.classList.remove('selected-day');
        });

        // Add highlight to clicked day
        if (info.dayEl) {
          info.dayEl.classList.add('selected-day');
        }
      },
      datesSet: function () {
        // Re-apply selected day highlighting after month changes
        if (selectedCalendarDate) {
          const dayEl = document.querySelector(`.fc-daygrid-day[data-date="${selectedCalendarDate}"]`);
          if (dayEl) {
            dayEl.classList.add('selected-day');
          }
        }
      },
      eventDrop: saveEvents,
      eventResize: saveEvents
    });

    dayCalendar.render();
    monthCalendar.render();
    window.calendarsInitialized = true;
    console.log('✅ Calendars initialized and rendered');
  }

  // Event Modal
  const eventModal = document.getElementById('eventModal');
  const closeModal = document.getElementById('closeModal');
  const saveEventBtn = document.getElementById('saveEvent');
  const deleteEventBtn = document.getElementById('deleteEvent');
  const trackEventFlightBtn = document.getElementById('trackEventFlight');

  function openEventModal(event, start, end) {
    if (event) {
      // Edit mode
      document.getElementById('modalTitle').textContent = 'Edit Event';
      document.getElementById('eventTitle').value = event.title;
      document.getElementById('eventStart').value = formatDateTimeLocal(event.start);
      document.getElementById('eventEnd').value = event.end ? formatDateTimeLocal(event.end) : '';
      document.getElementById('eventNotes').value = event.extendedProps?.notes || '';
      selectedColor = event.backgroundColor || '#3788d8';
      editingEventId = event.id;
      deleteEventBtn.style.display = 'inline-block';
      // Show Track Flight button for existing events
      if (trackEventFlightBtn) trackEventFlightBtn.style.display = 'inline-block';
    } else {
      // Create mode
      document.getElementById('modalTitle').textContent = 'New Event';
      document.getElementById('eventTitle').value = '';
      document.getElementById('eventStart').value = formatDateTimeLocal(start);
      document.getElementById('eventEnd').value = end ? formatDateTimeLocal(end) : '';
      document.getElementById('eventNotes').value = '';
      selectedColor = '#3788d8';
      editingEventId = null;
      deleteEventBtn.style.display = 'none';
      // Hide Track Flight button for new events
      if (trackEventFlightBtn) trackEventFlightBtn.style.display = 'none';
    }

    updateColorSelection(eventModal, selectedColor);
    eventModal.classList.add('active');
  }

  closeModal.addEventListener('click', () => {
    eventModal.classList.remove('active');
  });

  eventModal.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedColor = btn.dataset.color;
      updateColorSelection(eventModal, selectedColor);
    });
  });

  saveEventBtn.addEventListener('click', () => {
    const title = document.getElementById('eventTitle').value.trim();
    const start = document.getElementById('eventStart').value;
    const end = document.getElementById('eventEnd').value;
    const notes = document.getElementById('eventNotes').value.trim();

    if (!title || !start) {
      alert('Please fill in title and start time');
      return;
    }

    const eventData = {
      id: editingEventId || generateId(),
      title: title,
      start: start,
      end: end || start,
      backgroundColor: selectedColor,
      borderColor: selectedColor,
      extendedProps: {
        notes: notes
      }
    };

    if (editingEventId) {
      // Update existing event in both calendars
      const dayEvent = dayCalendar.getEventById(editingEventId);
      const monthEvent = monthCalendar.getEventById(editingEventId);

      if (dayEvent) {
        dayEvent.setProp('title', title);
        dayEvent.setStart(start);
        dayEvent.setEnd(end || start);
        dayEvent.setProp('backgroundColor', selectedColor);
        dayEvent.setProp('borderColor', selectedColor);
        dayEvent.setExtendedProp('notes', notes);
      }
      if (monthEvent) {
        monthEvent.setProp('title', title);
        monthEvent.setStart(start);
        monthEvent.setEnd(end || start);
        monthEvent.setProp('backgroundColor', selectedColor);
        monthEvent.setProp('borderColor', selectedColor);
        monthEvent.setExtendedProp('notes', notes);
      }
    } else {
      // Create new event
      dayCalendar.addEvent(eventData);
      monthCalendar.addEvent(eventData);
    }

    // Auto-add flight if event contains "flight" and has notes
    if (title.toLowerCase().includes('flight') && notes && window.mapIntegration) {
      const route = notes.trim().toUpperCase();
      // Check if notes contain airport codes (e.g., JFK-LAX or JFK → LAX)
      if (route.match(/[A-Z]{3}[\s\-→]+[A-Z]{3}/)) {
        // Extract flight number from title (e.g., "Flight to Phoenix (AA 432)" -> "AA432")
        let flightNumber = '';
        const flightNumMatch = title.match(/\b([A-Z]{2})\s*(\d{1,4})\b/i);
        if (flightNumMatch) {
          flightNumber = `${flightNumMatch[1].toUpperCase()}${flightNumMatch[2]}`;
        }
        console.log('✈️ Auto-adding flight from calendar event:', title, route, 'Flight#:', flightNumber);
        setTimeout(async () => {
          try {
            await window.mapIntegration.addFlight(flightNumber, route);
            console.log('✅ Flight auto-added from calendar');
          } catch (error) {
            console.error('❌ Failed to auto-add flight:', error);
          }
        }, 500);
      }
    }

    saveEvents();
    eventModal.classList.remove('active');
  });

  deleteEventBtn.addEventListener('click', async () => {
    if (editingEventId) {
      const confirmed = await showConfirmModal({
        icon: '🗑️',
        title: 'Delete Event',
        message: 'Are you sure you want to delete this event?',
        details: document.getElementById('eventTitle').value || 'Untitled Event',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger'
      });

      if (confirmed) {
        const dayEvent = dayCalendar.getEventById(editingEventId);
        const monthEvent = monthCalendar.getEventById(editingEventId);
        if (dayEvent) dayEvent.remove();
        if (monthEvent) monthEvent.remove();
        saveEvents();
        eventModal.classList.remove('active');
        showToast('Event deleted', 'success');
      }
    }
  });

  // Track Flight from Event button handler
  if (trackEventFlightBtn) {
    trackEventFlightBtn.addEventListener('click', async () => {
      if (!editingEventId) return;

      // Get event data from the modal
      const title = document.getElementById('eventTitle').value;
      const start = document.getElementById('eventStart').value;
      const end = document.getElementById('eventEnd').value;
      const notesField = document.getElementById('eventNotes');
      const notes = notesField?.value || '';
      const location = document.getElementById('eventLocation')?.value || '';

      // Check if route info exists in notes/title/location before proceeding
      const combined = `${notes} ${title} ${location}`.toLowerCase();
      const hasRoute = /(\w+[\s\w]*)\s*(to|→|->|–|-)\s*(\w+[\s\w]*)/.test(combined);

      if (!hasRoute) {
        await showConfirmModal({
          icon: '✈️',
          title: 'Route Information Needed',
          message: 'Add departure and arrival cities to the Notes field.\n\nExample: "New York to Los Angeles" or "Miami - Chicago"',
          confirmText: 'OK',
          cancelText: null,
          type: 'warning'
        });
        // Focus on notes field so user can add the info
        if (notesField) {
          notesField.focus();
          notesField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // Auto-initialize map if not ready
      if (!mapIntegration && window.google && window.MapIntegration) {
        await window.initMap();
      }

      if (!mapIntegration) {
        // Map still not ready - initialize it now
        showToast('Initializing map...', 'info');
        await window.initMap?.();
        // Give it a moment
        await new Promise(r => setTimeout(r, 500));
      }

      if (!mapIntegration) {
        showToast('Could not initialize map. Try opening World Map first.', 'error');
        return;
      }

      // Create event object for the map integration
      const eventData = {
        title: title,
        start: start,
        end: end,
        extendedProps: { notes: notes, location: location }
      };

      const result = await mapIntegration.addFlightFromCalendar(eventData);

      if (result) {
        eventModal.classList.remove('active');
        showToast('Flight added to tracker - view on World Map', 'success');
        // Stay on calendar view, don't switch to world map
      }
    });
  }

  // Google Calendar Modal
  const googleModal = document.getElementById('googleModal');
  const addCalendarBtn = document.getElementById('addCalendarBtn');
  const closeGoogleModal = document.getElementById('closeGoogleModal');
  const importCalendarBtn = document.getElementById('importCalendar');

  addCalendarBtn.addEventListener('click', () => {
    googleModal.classList.add('active');
    loadAddedCalendars();
  });

  // Add Event button - opens modal for new event
  const addEventBtn = document.getElementById('addEventBtn');
  if (addEventBtn) {
    addEventBtn.addEventListener('click', () => {
      // Get current date/time from dayCalendar or use now
      const now = new Date();
      const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // +1 hour
      openEventModal(null, startTime, endTime);
    });
  }

  closeGoogleModal.addEventListener('click', () => {
    googleModal.classList.remove('active');
  });

  function loadAddedCalendars() {
    const settings = JSON.parse(localStorage.getItem(GOOGLE_CALENDARS_KEY) || '[]');
    const list = document.getElementById('addedCalendarsList');
    list.innerHTML = '';

    settings.forEach(cal => {
      const li = document.createElement('li');
      li.style.padding = '8px 0';
      li.style.borderBottom = '1px solid rgba(0, 255, 65, 0.1)';
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.innerHTML = `
        <span>${cal.summary || cal.calendarId}</span>
        <button onclick="removeGoogleCalendar('${cal.calendarId}')" style="background: #ff0040; border: none; color: white; padding: 4px 12px; cursor: pointer; font-family: 'VT323', monospace;">Remove</button>
      `;
      list.appendChild(li);
    });
  }

  window.removeGoogleCalendar = function(calendarId) {
    const settings = JSON.parse(localStorage.getItem(GOOGLE_CALENDARS_KEY) || '[]');
    const updated = settings.filter(cal => cal.calendarId !== calendarId);
    localStorage.setItem(GOOGLE_CALENDARS_KEY, JSON.stringify(updated));
    loadAddedCalendars();

    // Remove events from this calendar in all calendar views
    if (dayCalendar) {
      dayCalendar.getEvents().forEach(event => {
        if (event.extendedProps?.calendarId === calendarId) {
          event.remove();
        }
      });
    }
    if (monthCalendar) {
      monthCalendar.getEvents().forEach(event => {
        if (event.extendedProps?.calendarId === calendarId) {
          event.remove();
        }
      });
    }

    // Also remove from localStorage directly
    const allEvents = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const filteredEvents = allEvents.filter(event => event.extendedProps?.calendarId !== calendarId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredEvents));

    saveEvents();
  };

  importCalendarBtn.addEventListener('click', async () => {
    const calendarId = document.getElementById('calendarId').value.trim();
    if (!calendarId) {
      alert('Please enter a calendar ID');
      return;
    }

    try {
      importCalendarBtn.textContent = 'Importing...';
      importCalendarBtn.disabled = true;

      // Set time range for fetching events
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 2);
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 12);

      let result;

      // Use Electron IPC (preferred method)
      if (window.electronAPI && window.electronAPI.getCalendarEvents) {
        console.log('Using Electron IPC for calendar import');
        result = await window.electronAPI.getCalendarEvents(
          calendarId,
          timeMin.toISOString(),
          timeMax.toISOString()
        );
      } else {
        // Fallback to direct fetch (development/browser mode)
        console.log('Using fetch for calendar import');
        const response = await fetch(
          `http://localhost:3001/api/calendar/${encodeURIComponent(calendarId)}/events?` +
          `timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}`
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to fetch calendar');
        }

        const data = await response.json();
        result = { success: true, data };
      }

      // Check if there was an error
      if (!result.success) {
        throw new Error(result.error || 'Failed to import calendar');
      }

      const { events, calendarInfo } = result.data;

      // Save calendar info
      const settings = JSON.parse(localStorage.getItem(GOOGLE_CALENDARS_KEY) || '[]');
      if (!settings.find(cal => cal.calendarId === calendarId)) {
        settings.push({
          calendarId: calendarId,
          summary: calendarInfo.summary,
          color: '#' + Math.floor(Math.random()*16777215).toString(16)
        });
        localStorage.setItem(GOOGLE_CALENDARS_KEY, JSON.stringify(settings));
      }

      // Add events to calendar
      if (dayCalendar) {
        events.forEach(event => {
          const eventData = {
            id: event.id,
            title: event.summary || 'No Title',
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            backgroundColor: '#3788d8',
            extendedProps: {
              calendarId: calendarId,
              description: event.description,
              location: event.location
            }
          };
          dayCalendar.addEvent(eventData);
          monthCalendar.addEvent(eventData);
        });
        saveEvents();
      }

      console.log(`Imported ${events.length} events from ${calendarInfo.summary}`);
      loadAddedCalendars();
      document.getElementById('calendarId').value = '';

    } catch (error) {
      console.error('Import error:', error);
    } finally {
      importCalendarBtn.textContent = 'Import';
      importCalendarBtn.disabled = false;
    }
  });

  // Outlook Calendar Modal
  const outlookModal = document.getElementById('outlookModal');
  const addOutlookBtn = document.getElementById('addOutlookBtn');
  const closeOutlookModal = document.getElementById('closeOutlookModal');
  const outlookImportBtn = document.getElementById('outlookImportBtn');

  addOutlookBtn.addEventListener('click', () => {
    outlookModal.classList.add('active');
  });

  closeOutlookModal.addEventListener('click', () => {
    outlookModal.classList.remove('active');
  });

  outlookImportBtn.addEventListener('click', async () => {
    const url = document.getElementById('outlookIcalUrl').value.trim();
    if (!url) {
      alert('Please enter an iCal URL');
      return;
    }

    try {
      outlookImportBtn.textContent = 'Importing...';
      outlookImportBtn.disabled = true;

      const response = await fetch(`http://localhost:3001/outlook-calendar?url=${encodeURIComponent(url)}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to import Outlook calendar');
      }

      // Add events to calendar
      if (dayCalendar) {
        result.data.forEach(event => {
          dayCalendar.addEvent(event);
          monthCalendar.addEvent(event);
        });
        saveEvents();
      }

      console.log(`Imported ${result.data.length} events from Outlook`);
      document.getElementById('outlookIcalUrl').value = '';

    } catch (error) {
      console.error('Outlook import error:', error);
    } finally {
      outlookImportBtn.textContent = 'Import Calendar';
      outlookImportBtn.disabled = false;
    }
  });

  // File search is handled in the FILES VIEW section at the end of this file

  // Close modals on outside click
  [googleModal, outlookModal, eventModal, addClientModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // News Brief functionality
  const newsFilters = document.querySelectorAll('.newsbrief-filter');
  const newsSections = document.querySelectorAll('.news-section');
  const refreshNewsBtn = document.getElementById('refreshNewsBtn');
  const generateSummaryBtn = document.getElementById('generateSummaryBtn');

  // Filter news sources
  newsFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      const source = btn.dataset.source;

      // Update active filter
      newsFilters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show/hide sections
      newsSections.forEach(section => {
        if (source === 'all') {
          section.style.display = 'flex';
        } else {
          const sectionClass = `${source}-section`;
          section.style.display = section.classList.contains(sectionClass) ? 'flex' : 'none';
        }
      });
    });
  });

  // Refresh news
  if (refreshNewsBtn) {
    refreshNewsBtn.addEventListener('click', async () => {
      console.log('Refreshing news...');
      refreshNewsBtn.textContent = '⟳ LOADING...';
      refreshNewsBtn.disabled = true;

      setTimeout(() => {
        refreshNewsBtn.textContent = '↻ REFRESH';
        refreshNewsBtn.disabled = false;
      }, 1500);
    });
  }

  // Generate AI summary
  if (generateSummaryBtn) {
    generateSummaryBtn.addEventListener('click', async () => {
      console.log('Generating AI summary...');
      const summaryContent = document.getElementById('newsSummary');

      generateSummaryBtn.textContent = 'GENERATING...';
      generateSummaryBtn.disabled = true;

      // Simulate AI summary generation (replace with Claude API)
      setTimeout(() => {
        if (summaryContent) {
          summaryContent.innerHTML = `
            <div class="message-text">
              <strong>KEY FINANCIAL HEADLINES - ${new Date().toLocaleDateString()}</strong>
            </div>
            <div class="message-text" style="margin-top: 15px;">
              <strong>Markets & Economy:</strong><br>
              Federal Reserve signals potential rate adjustments in Q2, with tech stocks showing positive momentum (+2.3%). Small business confidence reaches 5-year high with 78% planning expansion.
            </div>
            <div class="message-text" style="margin-top: 15px;">
              <strong>Industry Updates:</strong><br>
              New tax regulations for Q1 2026 impact deferred revenue accounting. CFOs should review compliance requirements. QuickBooks latest update may affect legacy integrations.
            </div>
            <div class="message-text" style="margin-top: 15px;">
              <strong>Recommendations:</strong><br>
              • Review client portfolios for rate adjustment impact<br>
              • Update tax compliance procedures<br>
              • Monitor QuickBooks integration status<br>
              • Consider expansion opportunities for growth-stage clients
            </div>
            <div class="message-text" style="margin-top: 15px; color: rgba(0, 255, 65, 0.6); font-size: 14px;">
              Generated by AI • Based on ${document.querySelectorAll('.news-item').length} news items
            </div>
          `;
        }

        generateSummaryBtn.textContent = 'GENERATE';
        generateSummaryBtn.disabled = false;
      }, 2000);
    });
  }

  // Gmail functionality (legacy - kept for backward compatibility)
  const composeEmailModal = document.getElementById('composeEmailModal');
  const closeComposeModal = document.getElementById('closeComposeModal');
  const emailDetailModal = document.getElementById('emailDetailModal');
  const closeEmailDetailModal = document.getElementById('closeEmailDetailModal');

  // Gmail Search (using correct ID)
  const emailSearchInput = document.getElementById('emailSearchInput');
  if (emailSearchInput) {
    emailSearchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      const emailItems = document.querySelectorAll('.email-item');

      emailItems.forEach(item => {
        const sender = item.querySelector('.email-sender')?.textContent.toLowerCase() || '';
        const subject = item.querySelector('.email-subject')?.textContent.toLowerCase() || '';
        const preview = item.querySelector('.email-preview')?.textContent.toLowerCase() || '';

        const matchesSearch = sender.includes(searchTerm) ||
                             subject.includes(searchTerm) ||
                             preview.includes(searchTerm);

        item.style.display = matchesSearch ? '' : 'none';
      });
    });
  }

  // Compose email (with null checks)
  const composeBtn = document.getElementById('emailComposeBtn');
  if (composeBtn && composeEmailModal) {
    composeBtn.addEventListener('click', () => {
      composeEmailModal.classList.add('active');
      // Clear form
      document.getElementById('emailTo').value = '';
      document.getElementById('emailSubject').value = '';
      document.getElementById('emailBody').value = '';
    });
  }

  if (closeComposeModal && composeEmailModal) {
    closeComposeModal.addEventListener('click', () => {
      composeEmailModal.classList.remove('active');
    });
  }

  // AI Draft button - opens chat with prompt template (does not auto-send)
  const aiDraftBtn = document.getElementById('aiDraftBtn');
  if (aiDraftBtn) {
    aiDraftBtn.addEventListener('click', () => {
      const to = document.getElementById('emailTo')?.value || '';
      const subject = document.getElementById('emailSubject')?.value || '';
      const body = document.getElementById('emailBody')?.value || '';

      console.log('Opening AI chat for draft...');

      // Close the compose modal
      const composeModal = document.getElementById('composeEmailModal');
      if (composeModal) composeModal.classList.remove('active');

      // Switch to dashboard view
      document.querySelectorAll('.nav-item, .nav-btn').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      const dashNav = document.querySelector('[data-view="dashboard"]');
      if (dashNav) dashNav.classList.add('active');
      document.getElementById('dashboard-view')?.classList.add('active');

      // Pre-fill chat with prompt template
      setTimeout(() => {
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
          const emailContext = `Draft an email

To: ${to || '[recipient]'}
Subject: ${subject || '[subject]'}

Direction/Context: [ENTER YOUR DIRECTION HERE - e.g., "professional tone", "follow up on meeting", "request information"]

${body ? `------- CURRENT DRAFT -------\n${body}\n------- END DRAFT -------` : ''}`;

          chatInput.value = emailContext;
          chatInput.focus();
          // Scroll textarea to top first
          chatInput.scrollTop = 0;
          // Position cursor at the direction placeholder
          const placeholderStart = emailContext.indexOf('[ENTER YOUR DIRECTION HERE');
          if (placeholderStart > -1) {
            chatInput.setSelectionRange(placeholderStart, placeholderStart + 85);
          }
          // Scroll chat panel into view
          document.querySelector('.ai-chat-panel')?.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    });
  }

  // Send email
  const sendEmailBtn = document.getElementById('sendEmailBtn');
  if (sendEmailBtn) {
    sendEmailBtn.addEventListener('click', async () => {
      const to = document.getElementById('emailTo').value;
      const subject = document.getElementById('emailSubject').value;
      const body = document.getElementById('emailBody').value;

      if (!to || !subject || !body) {
        alert('Please fill in all fields');
        return;
      }

      try {
        sendEmailBtn.textContent = 'Sending...';
        sendEmailBtn.disabled = true;

        const response = await fetch('http://localhost:3001/api/gmail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, subject, body })
        });

        const data = await response.json();

        if (data.success) {
          composeEmailModal.classList.remove('active');
        } else {
          throw new Error(data.error || 'Failed to send email');
        }
      } catch (error) {
        console.error('Error sending email:', error);
      } finally {
        sendEmailBtn.textContent = 'SEND';
        sendEmailBtn.disabled = false;
      }
    });
  }

  // Save draft
  const saveDraftBtn = document.getElementById('saveDraftBtn');
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', () => {
      console.log('Saving draft...');
    });
  }

  // Connect Gmail (old dashboard panel - deprecated)
  const connectGmailBtn = document.getElementById('connectGmailBtn');
  if (connectGmailBtn) {
    connectGmailBtn.addEventListener('click', () => {
      // Redirect to Email tab
      document.querySelector('[data-view="email"]').click();
    });
  }

  // ==========================================
  // Email Module - Loaded from email-module.js
  // ==========================================

  // ==========================================
  // QuickBooks + Google Sheets Integration (in Files section)
  // ==========================================
  const sheetsUrlInput = document.getElementById('sheetsUrlInput');
  const connectSheetsBtn = document.getElementById('connectSheetsBtn');
  const uploadSheetBtn = document.getElementById('uploadSheetBtn');
  const sheetFileInput = document.getElementById('sheetFileInput');
  const quickbooksLoginBtn = document.getElementById('quickbooksLoginBtn');

  // Connect Google Sheets via URL (direct assignment like calendar import)
  if (connectSheetsBtn) {
    connectSheetsBtn.addEventListener('click', async () => {
      console.log('Sheets connect button clicked!');
      const url = sheetsUrlInput?.value?.trim();

      if (!url) {
        alert('Please enter a Google Sheets URL');
        return;
      }

      // Extract spreadsheet ID from URL
      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        alert('Invalid Google Sheets URL format.\n\nExpected format:\nhttps://docs.google.com/spreadsheets/d/SPREADSHEET_ID/...');
        return;
      }

      const spreadsheetId = match[1];
      console.log('Connecting to spreadsheet:', spreadsheetId);

      try {
        // Fetch public spreadsheet data (no auth required for public sheets)
        const metaResponse = await fetch(`http://localhost:3001/api/sheets/public/${spreadsheetId}`);
        const metadata = await metaResponse.json();

        if (!metadata.success) {
          console.error('Spreadsheet error:', metadata.error);
          return;
        }

        // Successfully connected - no popup needed
        console.log(`Connected to: ${metadata.title}`);

        // Save to localStorage with sheet data for Claude
        const connectedSheets = JSON.parse(localStorage.getItem('connected_sheets') || '[]');
        if (!connectedSheets.find(s => s.id === spreadsheetId)) {
          connectedSheets.push({
            id: spreadsheetId,
            title: metadata.title,
            sheets: metadata.sheets,
            url: url,
            data: metadata.data || [], // Include data for Claude context
            rowCount: metadata.rowCount,
            columnCount: metadata.columnCount
          });
          localStorage.setItem('connected_sheets', JSON.stringify(connectedSheets));

          // Save shortcut file to storage folder so it appears in Files section
          try {
            const shortcutContent = `[InternetShortcut]\nURL=${url}\n`;
            const safeTitle = metadata.title.replace(/[<>:"/\\|?*]/g, '_');
            // Convert to base64 with data: prefix as expected by saveFile
            const base64Data = 'data:application/internet-shortcut;base64,' + btoa(shortcutContent);
            await window.electronAPI.saveFile({
              fileName: `${safeTitle}.url`,
              fileData: base64Data,
              fileType: 'application/internet-shortcut',
              fileSize: shortcutContent.length,
              ownerType: 'sheets',
              ownerId: spreadsheetId,
              ownerName: metadata.title
            });
            console.log(`✅ Saved shortcut file for: ${metadata.title}`);
            // Refresh files view to show the new file
            if (typeof window.refreshFilesView === 'function') {
              window.refreshFilesView();
            }
          } catch (fileError) {
            console.error('Failed to save shortcut file:', fileError);
          }
        }

        // Update UI
        updateConnectedSourcesUI();
        if (sheetsUrlInput) sheetsUrlInput.value = '';

      } catch (error) {
        console.error('Sheets connection error:', error);
      }
    });
    console.log('✅ Sheets connect button handler attached');
  } else {
    console.error('❌ Could not find connectSheetsBtn element');
  }

  // Upload file handler
  if (uploadSheetBtn) {
    uploadSheetBtn.addEventListener('click', () => {
      if (sheetFileInput) sheetFileInput.click();
    });
  }

  if (sheetFileInput) {
    sheetFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log('File selected:', file.name);
      }
    });
  }

  // QuickBooks login (direct assignment like calendar import)
  if (quickbooksLoginBtn) {
    quickbooksLoginBtn.addEventListener('click', async () => {
      console.log('QuickBooks connect button clicked!');

      try {
        // Check if QuickBooks is configured
        const statusResponse = await fetch('http://localhost:3001/api/quickbooks/status');
        const status = await statusResponse.json();

        if (!status.configured) {
          console.log('QuickBooks not configured');
          return;
        }

        if (status.connected) {
          console.log('QuickBooks already connected');
        }

        // Open QuickBooks auth
        const authUrl = 'http://localhost:3001/quickbooks/auth';
        if (window.electronAPI?.openExternal) {
          window.electronAPI.openExternal(authUrl);
        } else {
          window.open(authUrl, '_blank');
        }

      } catch (error) {
        console.error('QuickBooks status check error:', error);
      }
    });
    console.log('✅ QuickBooks login button handler attached');
  }

  // Update connected sources - store globally for Claude access and refresh files view
  function updateConnectedSourcesUI() {
    try {
      const connectedSheets = JSON.parse(localStorage.getItem('connected_sheets') || '[]');
      // Store sheets globally for Claude access
      window.connectedGoogleSheets = connectedSheets;
      // Refresh files view to show new sheets (if function is available)
      if (typeof window.refreshFilesView === 'function') {
        window.refreshFilesView();
      }
    } catch (error) {
      console.error('Error updating connected sources:', error);
    }
  }

  // Initialize connected sources (defer to avoid errors before files view is ready)
  setTimeout(updateConnectedSourcesUI, 100);

  // Debug: Log all registered handlers
  console.log('=== Handler Registration Status ===');
  console.log('sheetsUrlInput:', sheetsUrlInput ? 'FOUND' : 'NOT FOUND');
  console.log('connectSheetsBtn:', connectSheetsBtn ? 'FOUND' : 'NOT FOUND');
  console.log('quickbooksLoginBtn:', quickbooksLoginBtn ? 'FOUND' : 'NOT FOUND');
  console.log('================================');

  // ==========================================
  // Collapsible Sidebar Menus
  // ==========================================
  const clientsHeader = document.getElementById('clientsHeader');
  const employeesHeader = document.getElementById('employeesHeader');
  const crmPipeHeader = document.getElementById('crmPipeHeader');

  // Toggle collapse function
  function toggleCollapse(header) {
    const content = header.nextElementSibling;
    header.classList.toggle('collapsed');
    content.classList.toggle('collapsed');
  }

  // Collapse all menus on program start
  function collapseAllMenus() {
    [clientsHeader, employeesHeader, crmPipeHeader].forEach(header => {
      if (header) {
        const content = header.nextElementSibling;
        header.classList.add('collapsed');
        if (content) content.classList.add('collapsed');
      }
    });
  }
  collapseAllMenus();

  if (clientsHeader) {
    clientsHeader.addEventListener('click', (e) => {
      // Don't toggle if clicking the + button
      if (e.target.classList.contains('add-client-btn')) return;
      toggleCollapse(clientsHeader);
    });
  }

  if (employeesHeader) {
    employeesHeader.addEventListener('click', (e) => {
      // Don't toggle if clicking the + button
      if (e.target.classList.contains('add-employee-btn')) return;
      toggleCollapse(employeesHeader);
    });
  }

  // ==========================================
  // Video Call Dropdown
  // ==========================================
  const videoCallBtn = document.getElementById('startVideoCall');
  const videoCallDropdown = document.getElementById('videoCallDropdown');

  if (videoCallBtn && videoCallDropdown) {
    videoCallBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      videoCallDropdown.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!videoCallDropdown.contains(e.target) && e.target !== videoCallBtn) {
        videoCallDropdown.classList.remove('active');
      }
    });

    // Platform URLs - use app protocols to open desktop apps
    const platformUrls = {
      zoom: 'zoommtg://zoom.us/start?confno=new',
      teams: 'msteams://teams.microsoft.com/l/meeting/new',
      meet: 'https://meet.google.com/new'
    };

    // Handle dropdown item clicks (start meeting) - click on icon or label area
    videoCallDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      // Add click handler to the entire item
      const handlePlatformClick = (e) => {
        // Don't trigger if clicking on invite button (check target and its parents)
        if (e.target.classList.contains('dropdown-invite') || e.target.closest('.dropdown-invite')) {
          console.log('Clicked on invite button, ignoring');
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const platform = item.dataset.platform;
        console.log('Video call dropdown clicked, platform:', platform);

        if (platform && platformUrls[platform]) {
          videoCallDropdown.classList.remove('active');
          const url = platformUrls[platform];
          console.log('Opening URL:', url);
          if (window.electronAPI?.openExternal) {
            window.electronAPI.openExternal(url).then(() => {
              console.log('URL opened successfully');
            }).catch(err => {
              console.error('Failed to open URL:', err);
              window.open(url, '_blank');
            });
          } else {
            window.open(url, '_blank');
          }
        } else {
          console.warn('No platform or URL found for:', platform);
        }
      };

      item.addEventListener('click', handlePlatformClick);

      // Also add handlers to child elements to ensure clicks propagate
      item.querySelectorAll('.dropdown-icon, .dropdown-label').forEach(child => {
        child.addEventListener('click', handlePlatformClick);
      });
    });

    // Handle Invite link clicks - copy link only (no extra text)
    videoCallDropdown.querySelectorAll('.dropdown-invite').forEach(inviteBtn => {
      inviteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const platform = inviteBtn.dataset.invite;
        let inviteLink = '';

        // Generate unique meeting ID
        const timestamp = Date.now().toString(36);
        const randomPart = Math.random().toString(36).substring(2, 8);
        const meetingId = `${timestamp}${randomPart}`;

        switch(platform) {
          case 'zoom':
            inviteLink = `https://zoom.us/j/${meetingId}`;
            break;
          case 'teams':
            inviteLink = `https://teams.microsoft.com/l/meetup-join/${meetingId}`;
            break;
          case 'meet':
            inviteLink = `https://meet.google.com/${meetingId.substring(0, 3)}-${meetingId.substring(3, 7)}-${meetingId.substring(7, 10)}`;
            break;
        }

        // Copy link only to clipboard
        try {
          await navigator.clipboard.writeText(inviteLink);

          // Visual feedback
          const originalText = inviteBtn.textContent;
          inviteBtn.textContent = 'Copied!';
          inviteBtn.style.background = 'rgba(0, 255, 65, 0.3)';
          inviteBtn.style.borderColor = '#00ff41';
          inviteBtn.style.color = '#00ff41';

          setTimeout(() => {
            inviteBtn.textContent = originalText;
            inviteBtn.style.background = '';
            inviteBtn.style.borderColor = '';
            inviteBtn.style.color = '';
          }, 2000);
        } catch (err) {
          console.error('Failed to copy invite link:', err);
        }
      });
    });
  }

  // ==========================================
  // Employee Management
  // ==========================================
  const EMPLOYEES_KEY = 'cfo_employees';
  const addEmployeeBtn = document.getElementById('addEmployeeBtn');

  function loadEmployees() {
    const stored = localStorage.getItem(EMPLOYEES_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  function saveEmployees(employees) {
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
  }

  function renderEmployees() {
    const employees = loadEmployees();
    const categories = {
      bookkeepers: document.getElementById('bookkeepersItems'),
      controllers: document.getElementById('controllersItems'),
      cfos: document.getElementById('cfosItems')
    };
    const counts = {
      bookkeepers: document.getElementById('bookkeepersCount'),
      controllers: document.getElementById('controllersCount'),
      cfos: document.getElementById('cfosCount')
    };

    // Clear all categories
    Object.values(categories).forEach(el => { if (el) el.innerHTML = ''; });

    // Group employees by category
    const grouped = { bookkeepers: [], controllers: [], cfos: [] };
    employees.forEach(emp => {
      if (grouped[emp.category]) {
        grouped[emp.category].push(emp);
      }
    });

    // Render each category
    Object.keys(grouped).forEach(category => {
      const container = categories[category];
      const count = counts[category];
      if (count) count.textContent = grouped[category].length;

      grouped[category].forEach(emp => {
        if (!container) return;
        const item = document.createElement('div');
        item.className = 'employee-item';
        item.innerHTML = `
          <span class="employee-name">${emp.name}</span>
          <span class="employee-title">${emp.title || ''}</span>
        `;
        item.addEventListener('click', () => window.showEmployeeCard(emp));
        container.appendChild(item);
      });
    });
  }

  // openEmployeeHUD is defined earlier - use window.showEmployeeCard

  // Employee Modal handling
  const addEmployeeModal = document.getElementById('addEmployeeModal');
  const closeAddEmployeeModal = document.getElementById('closeAddEmployeeModal');
  const saveEmployeeBtn = document.getElementById('saveEmployee');

  // Employee photo and file handling
  let employeePhotoData = null;
  let employeeFilesData = [];

  const employeePhotoBtn = document.getElementById('employeePhotoBtn');
  const employeePhotoInput = document.getElementById('employeePhotoInput');
  const employeePhotoPreview = document.getElementById('employeePhotoPreview');
  const employeePhotoRemove = document.getElementById('employeePhotoRemove');
  const employeeAttachBtn = document.getElementById('employeeAttachBtn');
  const employeeFileInput = document.getElementById('employeeFileInput');
  const employeeFilesList = document.getElementById('employeeFilesList');

  if (employeePhotoBtn) {
    employeePhotoBtn.addEventListener('click', () => employeePhotoInput.click());
  }

  if (employeePhotoInput) {
    employeePhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          employeePhotoData = e.target.result;
          employeePhotoPreview.innerHTML = `<img src="${employeePhotoData}" alt="Photo">`;
          employeePhotoRemove.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (employeePhotoRemove) {
    employeePhotoRemove.addEventListener('click', () => {
      employeePhotoData = null;
      employeePhotoPreview.innerHTML = '<span class="photo-preview-placeholder">👤</span>';
      employeePhotoRemove.style.display = 'none';
      employeePhotoInput.value = '';
    });
  }

  if (employeeAttachBtn) {
    employeeAttachBtn.addEventListener('click', () => employeeFileInput.click());
  }

  if (employeeFileInput) {
    employeeFileInput.addEventListener('change', (e) => {
      Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          employeeFilesData.push({
            name: file.name,
            size: file.size,
            type: file.type,
            data: ev.target.result
          });
          renderEmployeeFilesList();
        };
        reader.readAsDataURL(file);
      });
      employeeFileInput.value = '';
    });
  }

  function renderEmployeeFilesList() {
    if (!employeeFilesList) return;
    if (employeeFilesData.length === 0) {
      employeeFilesList.innerHTML = '<div class="no-files-message">No files attached</div>';
      return;
    }
    employeeFilesList.innerHTML = employeeFilesData.map((file, idx) => `
      <div class="file-attachment-item">
        <span class="file-attachment-icon">${getFileIcon(file.type)}</span>
        <span class="file-attachment-name">${file.name}</span>
        <span class="file-attachment-size">${formatFileSize(file.size)}</span>
        <button class="file-attachment-remove" data-idx="${idx}">✕</button>
      </div>
    `).join('');

    employeeFilesList.querySelectorAll('.file-attachment-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        employeeFilesData.splice(parseInt(btn.dataset.idx), 1);
        renderEmployeeFilesList();
      });
    });
  }

  function resetEmployeeForm() {
    document.getElementById('employeeName').value = '';
    document.getElementById('employeeLocation').value = '';
    document.getElementById('employeeTitle').value = '';
    document.getElementById('employeeCategory').value = 'bookkeepers';
    document.getElementById('employeeEmail').value = '';
    document.getElementById('employeePhone').value = '';
    document.getElementById('employeeNotes').value = '';
    employeePhotoData = null;
    employeeFilesData = [];
    if (employeePhotoPreview) employeePhotoPreview.innerHTML = '<span class="photo-preview-placeholder">👤</span>';
    if (employeePhotoRemove) employeePhotoRemove.style.display = 'none';
    renderEmployeeFilesList();
    resetHpBar('employeeHpCurrent', 'employeeHpBar');
  }

  // Initialize employee HP bar
  updateHpBar('employeeHpCurrent', 'employeeHpBar');

  if (addEmployeeBtn) {
    addEmployeeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (addEmployeeModal) {
        resetEmployeeForm();
        addEmployeeModal.classList.add('active');
      }
    });
  }

  if (closeAddEmployeeModal) {
    closeAddEmployeeModal.addEventListener('click', () => {
      addEmployeeModal.classList.remove('active');
    });
  }

  if (addEmployeeModal) {
    addEmployeeModal.addEventListener('click', (e) => {
      if (e.target === addEmployeeModal) {
        addEmployeeModal.classList.remove('active');
      }
    });
  }

  if (saveEmployeeBtn) {
    saveEmployeeBtn.addEventListener('click', () => {
      const name = document.getElementById('employeeName').value.trim();
      if (!name) {
        alert('Please enter an employee name');
        return;
      }

      const employees = loadEmployees();
      const newEmployee = {
        id: Date.now().toString(),
        name,
        location: document.getElementById('employeeLocation').value.trim(),
        title: document.getElementById('employeeTitle').value.trim(),
        category: document.getElementById('employeeCategory').value,
        email: document.getElementById('employeeEmail').value.trim(),
        phone: document.getElementById('employeePhone').value.trim(),
        notes: document.getElementById('employeeNotes').value.trim(),
        photo: employeePhotoData,
        files: employeeFilesData,
        hp: parseInt(document.getElementById('employeeHpCurrent')?.value) || 100
      };
      employees.push(newEmployee);
      saveEmployees(employees);
      renderEmployees();

      // Create folder for employee and save card info
      if (window.electronAPI?.createCardFolder) {
        window.electronAPI.createCardFolder({
          ownerType: 'employee',
          ownerId: newEmployee.id,
          ownerName: newEmployee.name,
          cardData: {
            email: newEmployee.email,
            phone: newEmployee.phone,
            location: newEmployee.location,
            title: newEmployee.title,
            category: newEmployee.category,
            notes: newEmployee.notes,
            photo: newEmployee.photo
          }
        }).then(result => {
          if (result.success) {
            console.log(`✅ Created folder for employee: ${newEmployee.name}`);
          }
        }).catch(err => console.error('Error creating employee folder:', err));
      }

      resetEmployeeForm();
      addEmployeeModal.classList.remove('active');

      // Refresh employee markers on map
      if (window.mapIntegration && window.mapIntegration.refreshEmployeeMarkers) {
        window.mapIntegration.refreshEmployeeMarkers();
      }
    });
  }

  // Initialize employees
  renderEmployees();

  // ==========================================
  // CRM Pipeline (Table-based with pipe images)
  // ==========================================
  const CRM_KEY = 'crm_pipeline';
  const addLeadBtn = document.getElementById('addLeadBtn');
  const addCrmPipeBtn = document.getElementById('addCrmPipeBtn');
  // crmPipeHeader is declared in the Collapsible Sidebar Menus section
  const crmPipeList = document.getElementById('crmPipeList');

  const stageNames = ['', 'CONTACT', 'FIRST CALL', 'PROPOSAL', 'FOLLOW UP', 'SIGNED'];

  function loadPipeline() {
    const stored = localStorage.getItem(CRM_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  function savePipeline(leads) {
    localStorage.setItem(CRM_KEY, JSON.stringify(leads));
    renderCrmPipeSidebar(); // Update sidebar when pipeline changes
  }

  // Render CRM Pipe sidebar list
  function renderCrmPipeSidebar() {
    if (!crmPipeList) return;

    const leads = loadPipeline();
    crmPipeList.innerHTML = '';

    if (leads.length === 0) {
      crmPipeList.innerHTML = '<div style="padding: 10px; color: rgba(0,255,65,0.5); font-size: 14px;">No leads yet</div>';
      return;
    }

    leads.forEach(lead => {
      const item = document.createElement('div');
      item.className = 'crmpipe-item';
      item.dataset.leadId = lead.id;
      item.innerHTML = `
        <div class="crmpipe-item-info">
          <span class="crmpipe-item-name">${lead.name}</span>
          <span class="crmpipe-item-company">${lead.company || ''}</span>
        </div>
        <span class="crmpipe-item-stage">${stageNames[lead.stage] || 'NEW'}</span>
        <button class="crmpipe-delete-btn" data-lead-id="${lead.id}" title="Delete">✕</button>
      `;

      // Click to open lead info card
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('crmpipe-delete-btn')) return;
        window.showCrmPipeCard(lead);
      });

      crmPipeList.appendChild(item);
    });

    // Add delete handlers
    crmPipeList.querySelectorAll('.crmpipe-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const leadId = btn.dataset.leadId;
        const lead = loadPipeline().find(l => l.id === leadId);
        showDeleteConfirm(lead?.name || 'this lead', 'lead', async () => {
          const updatedLeads = loadPipeline().filter(l => l.id !== leadId);
          localStorage.setItem(CRM_KEY, JSON.stringify(updatedLeads));
          renderCrmPipeSidebar();
          renderPipeline();

          // Delete the lead's file folder from disk
          if (lead && window.electronAPI?.deleteOwnerFolder) {
            try {
              await window.electronAPI.deleteOwnerFolder({
                ownerType: 'lead',
                ownerId: lead.id,
                ownerName: lead.name
              });
              console.log(`🗑️ Deleted lead folder for: ${lead.name}`);
            } catch (e) {
              console.error('Error deleting lead folder:', e);
            }
          }
        });
      });
    });
  }

  // CRM Pipe header collapse toggle
  if (crmPipeHeader) {
    crmPipeHeader.addEventListener('click', (e) => {
      if (e.target.classList.contains('add-crmpipe-btn')) return;
      toggleCollapse(crmPipeHeader);
    });
  }

  // LinkedIn header collapse toggle
  const linkedinHeader = document.getElementById('linkedinHeader');
  if (linkedinHeader) {
    linkedinHeader.addEventListener('click', () => {
      toggleCollapse(linkedinHeader);
    });
    // Collapse LinkedIn on startup
    const linkedinContent = linkedinHeader.nextElementSibling;
    linkedinHeader.classList.add('collapsed');
    if (linkedinContent) linkedinContent.classList.add('collapsed');
  }

  // LinkedIn sidebar button click handlers
  document.querySelectorAll('.linkedin-sidebar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      if (url) {
        window.electronAPI.openExternal(url);
      }
    });
  });

  // CRM Pipe Modal handling
  const addCrmPipeModal = document.getElementById('addCrmPipeModal');
  const closeAddCrmPipeModal = document.getElementById('closeAddCrmPipeModal');
  const saveCrmPipeBtn = document.getElementById('saveCrmPipe');

  // CRM Pipe photo and file handling
  let crmPipePhotoData = null;
  let crmPipeFilesData = [];

  const crmPipePhotoBtn = document.getElementById('crmPipePhotoBtn');
  const crmPipePhotoInput = document.getElementById('crmPipePhotoInput');
  const crmPipePhotoPreview = document.getElementById('crmPipePhotoPreview');
  const crmPipePhotoRemove = document.getElementById('crmPipePhotoRemove');
  const crmPipeAttachBtn = document.getElementById('crmPipeAttachBtn');
  const crmPipeFileInput = document.getElementById('crmPipeFileInput');
  const crmPipeFilesList = document.getElementById('crmPipeFilesList');

  if (crmPipePhotoBtn) {
    crmPipePhotoBtn.addEventListener('click', () => crmPipePhotoInput.click());
  }

  if (crmPipePhotoInput) {
    crmPipePhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          crmPipePhotoData = e.target.result;
          crmPipePhotoPreview.innerHTML = `<img src="${crmPipePhotoData}" alt="Photo">`;
          crmPipePhotoRemove.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (crmPipePhotoRemove) {
    crmPipePhotoRemove.addEventListener('click', () => {
      crmPipePhotoData = null;
      crmPipePhotoPreview.innerHTML = '<span class="photo-preview-placeholder">👤</span>';
      crmPipePhotoRemove.style.display = 'none';
      crmPipePhotoInput.value = '';
    });
  }

  if (crmPipeAttachBtn) {
    crmPipeAttachBtn.addEventListener('click', () => crmPipeFileInput.click());
  }

  if (crmPipeFileInput) {
    crmPipeFileInput.addEventListener('change', (e) => {
      Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          crmPipeFilesData.push({
            name: file.name,
            size: file.size,
            type: file.type,
            data: ev.target.result
          });
          renderCrmPipeFilesList();
        };
        reader.readAsDataURL(file);
      });
      crmPipeFileInput.value = '';
    });
  }

  function renderCrmPipeFilesList() {
    if (!crmPipeFilesList) return;
    if (crmPipeFilesData.length === 0) {
      crmPipeFilesList.innerHTML = '<div class="no-files-message">No files attached</div>';
      return;
    }
    crmPipeFilesList.innerHTML = crmPipeFilesData.map((file, idx) => `
      <div class="file-attachment-item">
        <span class="file-attachment-icon">${getFileIcon(file.type)}</span>
        <span class="file-attachment-name">${file.name}</span>
        <span class="file-attachment-size">${formatFileSize(file.size)}</span>
        <button class="file-attachment-remove" data-idx="${idx}">✕</button>
      </div>
    `).join('');

    crmPipeFilesList.querySelectorAll('.file-attachment-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        crmPipeFilesData.splice(parseInt(btn.dataset.idx), 1);
        renderCrmPipeFilesList();
      });
    });
  }

  function resetCrmPipeForm() {
    document.getElementById('crmPipeName').value = '';
    document.getElementById('crmPipeLocation').value = '';
    document.getElementById('crmPipeCompany').value = '';
    document.getElementById('crmPipeEmail').value = '';
    document.getElementById('crmPipePhone').value = '';
    document.getElementById('crmPipeStage').value = '1';
    document.getElementById('crmPipeValue').value = '';
    document.getElementById('crmPipeNotes').value = '';
    crmPipePhotoData = null;
    crmPipeFilesData = [];
    if (crmPipePhotoPreview) crmPipePhotoPreview.innerHTML = '<span class="photo-preview-placeholder">👤</span>';
    if (crmPipePhotoRemove) crmPipePhotoRemove.style.display = 'none';
    renderCrmPipeFilesList();
    resetHpBar('crmPipeHpCurrent', 'crmPipeHpBar');
  }

  // Initialize CRM Pipe HP bar
  updateHpBar('crmPipeHpCurrent', 'crmPipeHpBar');

  function openCrmPipeModal() {
    if (addCrmPipeModal) {
      resetCrmPipeForm();
      addCrmPipeModal.classList.add('active');
    }
  }

  // Add new lead from sidebar
  if (addCrmPipeBtn) {
    addCrmPipeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCrmPipeModal();
    });
  }

  if (closeAddCrmPipeModal) {
    closeAddCrmPipeModal.addEventListener('click', () => {
      addCrmPipeModal.classList.remove('active');
    });
  }

  if (addCrmPipeModal) {
    addCrmPipeModal.addEventListener('click', (e) => {
      if (e.target === addCrmPipeModal) {
        addCrmPipeModal.classList.remove('active');
      }
    });
  }

  if (saveCrmPipeBtn) {
    saveCrmPipeBtn.addEventListener('click', () => {
      const name = document.getElementById('crmPipeName').value.trim();
      if (!name) {
        alert('Please enter a lead name');
        return;
      }

      const leads = loadPipeline();
      const newLead = {
        id: Date.now().toString(),
        name,
        location: document.getElementById('crmPipeLocation').value.trim(),
        company: document.getElementById('crmPipeCompany').value.trim(),
        email: document.getElementById('crmPipeEmail').value.trim(),
        phone: document.getElementById('crmPipePhone').value.trim(),
        stage: parseInt(document.getElementById('crmPipeStage').value) || 1,
        value: parseFloat(document.getElementById('crmPipeValue').value) || 0,
        notes: document.getElementById('crmPipeNotes').value.trim(),
        photo: crmPipePhotoData,
        files: crmPipeFilesData,
        hp: parseInt(document.getElementById('crmPipeHpCurrent')?.value) || 100
      };
      leads.push(newLead);
      localStorage.setItem(CRM_KEY, JSON.stringify(leads));
      renderCrmPipeSidebar();
      renderPipeline();

      // Create folder for lead and save card info
      if (window.electronAPI?.createCardFolder) {
        window.electronAPI.createCardFolder({
          ownerType: 'lead',
          ownerId: newLead.id,
          ownerName: newLead.name,
          cardData: {
            email: newLead.email,
            phone: newLead.phone,
            location: newLead.location,
            company: newLead.company,
            stage: newLead.stage,
            value: newLead.value,
            notes: newLead.notes,
            photo: newLead.photo
          }
        }).then(result => {
          if (result.success) {
            console.log(`✅ Created folder for lead: ${newLead.name}`);
          }
        }).catch(err => console.error('Error creating lead folder:', err));
      }

      resetCrmPipeForm();
      addCrmPipeModal.classList.remove('active');
    });
  }

  function renderPipeline() {
    const leads = loadPipeline();
    const table = document.querySelector('.pipeline-table');
    if (!table) return;

    const thead = table.querySelector('thead tr');
    const tbody = document.getElementById('pipelineBody');
    if (!thead || !tbody) return;

    // Clear existing lead columns from header (keep only stage label)
    while (thead.children.length > 1) {
      thead.removeChild(thead.lastChild);
    }

    // Clear existing pipe cells from rows (keep only stage labels)
    tbody.querySelectorAll('.stage-row').forEach(row => {
      while (row.children.length > 1) {
        row.removeChild(row.lastChild);
      }
    });

    // Add columns for each lead
    leads.forEach(lead => {
      // Add header column
      const th = document.createElement('th');
      th.className = 'lead-name-col';
      th.dataset.leadId = lead.id;
      th.innerHTML = `
        <div class="lead-header">
          <span class="lead-name">${lead.name}</span>
          <span class="lead-company">${lead.company || ''}</span>
          <button class="delete-lead-btn" data-lead-id="${lead.id}" title="Delete">✕</button>
        </div>
      `;
      thead.appendChild(th);

      // Add pipe cells for each stage row (5 rows)
      tbody.querySelectorAll('.stage-row').forEach(row => {
        const stageNum = parseInt(row.dataset.stage);
        const td = document.createElement('td');
        td.className = 'pipe-cell';
        td.dataset.leadId = lead.id;
        td.dataset.stage = stageNum;

        // Check if this stage is completed (stage <= lead.stage)
        const isCompleted = stageNum <= lead.stage;
        if (isCompleted) {
          td.classList.add('completed');
        } else {
          td.classList.add('empty');
        }

        // Stage 5 (CLOSED) gets special treatment with star on top
        if (stageNum === 5) {
          td.classList.add('final-stage');
          td.innerHTML = `
            <div class="pipe-with-star">
              <img src="Assets/Star.png" class="star-image" alt="Star">
              <img src="Assets/Pipe.png" class="pipe-image pipe-lowered" alt="Pipe">
            </div>
          `;
        } else {
          td.innerHTML = `<img src="Assets/Pipe.png" class="pipe-image" alt="Pipe">`;
        }

        // Click to toggle stage
        td.addEventListener('click', () => {
          const currentLeads = loadPipeline();
          const leadData = currentLeads.find(l => l.id === lead.id);
          if (leadData) {
            // If clicking on the current stage, decrease by 1
            // Otherwise set to this stage
            if (stageNum === leadData.stage) {
              leadData.stage = Math.max(0, stageNum - 1);
              savePipeline(currentLeads);
              renderPipeline();
            } else if (stageNum === 5) {
              // Stage 5 (SIGNED) - Convert to client
              showConvertToClientConfirm(leadData);
            } else {
              leadData.stage = stageNum;
              savePipeline(currentLeads);
              renderPipeline();
            }
          }
        });

        row.appendChild(td);
      });
    });

    // Add delete button handlers in pipeline table
    document.querySelectorAll('.delete-lead-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const leadId = btn.dataset.leadId;
        const lead = loadPipeline().find(l => l.id === leadId);
        showDeleteConfirm(lead?.name || 'this lead', 'lead', async () => {
          const updatedLeads = loadPipeline().filter(l => l.id !== leadId);
          savePipeline(updatedLeads);
          renderPipeline();
          renderCrmPipeSidebar();  // Also update the sidebar

          // Delete the lead's file folder from disk
          if (lead && window.electronAPI?.deleteOwnerFolder) {
            try {
              await window.electronAPI.deleteOwnerFolder({
                ownerType: 'lead',
                ownerId: lead.id,
                ownerName: lead.name
              });
              console.log(`🗑️ Deleted lead folder for: ${lead.name}`);
            } catch (e) {
              console.error('Error deleting lead folder:', e);
            }
          }
        });
      });
    });
  }

  if (addLeadBtn) {
    addLeadBtn.addEventListener('click', () => {
      openCrmPipeModal();
    });
  }

  // Show confirmation dialog to convert lead to client
  function showConvertToClientConfirm(lead) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay active';
    overlay.innerHTML = `
      <div class="confirm-modal">
        <div class="confirm-icon">🎉</div>
        <div class="confirm-title">Convert to Client?</div>
        <div class="confirm-message">
          <strong>${lead.name}</strong> has reached the SIGNED stage!<br><br>
          This will move them from CRM Pipeline to Clients, keeping all their information and files.
        </div>
        <div class="confirm-buttons">
          <button class="confirm-btn cancel">Cancel</button>
          <button class="confirm-btn confirm">Convert to Client</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.cancel').addEventListener('click', () => {
      overlay.remove();
    });

    overlay.querySelector('.confirm').addEventListener('click', async () => {
      await convertLeadToClient(lead);
      overlay.remove();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // Convert a lead to a client
  async function convertLeadToClient(lead) {
    try {
      // Create client from lead data
      const newClient = {
        id: Date.now().toString(),
        name: lead.name,
        location: lead.location || '',
        email: lead.email || '',
        phone: lead.phone || '',
        company: lead.company || '',
        notes: lead.notes || '',
        photo: lead.photo || null,
        hp: lead.hp !== undefined ? lead.hp : 100,
        status: 'Active',
        color: '#00ff41',
        convertedFromLead: lead.id,
        convertedDate: new Date().toISOString()
      };

      // Add to clients
      const clients = loadClients();
      clients.push(newClient);
      saveClients(clients);

      // Move files folder from Leads to Clients
      if (window.electronAPI?.moveLeadToClient) {
        const result = await window.electronAPI.moveLeadToClient({
          leadId: lead.id,
          leadName: lead.name,
          clientId: newClient.id,
          clientName: newClient.name
        });
        if (result.success) {
          console.log(`✅ Moved folder from Leads to Clients: ${lead.name}`);
        } else {
          console.warn('Could not move folder:', result.error);
          // Still create a new folder for the client
          if (window.electronAPI?.createCardFolder) {
            await window.electronAPI.createCardFolder({
              ownerType: 'client',
              ownerId: newClient.id,
              ownerName: newClient.name,
              cardData: {
                email: newClient.email,
                phone: newClient.phone,
                location: newClient.location,
                company: newClient.company,
                notes: newClient.notes,
                photo: newClient.photo
              }
            });
          }
        }
      } else {
        // Fallback: create new client folder
        if (window.electronAPI?.createCardFolder) {
          await window.electronAPI.createCardFolder({
            ownerType: 'client',
            ownerId: newClient.id,
            ownerName: newClient.name,
            cardData: {
              email: newClient.email,
              phone: newClient.phone,
              location: newClient.location,
              company: newClient.company,
              notes: newClient.notes,
              photo: newClient.photo
            }
          });
        }
      }

      // Remove from pipeline
      const updatedLeads = loadPipeline().filter(l => l.id !== lead.id);
      savePipeline(updatedLeads);

      // Refresh UI
      renderClients();
      renderPipeline();
      renderCrmPipeSidebar();

      // Show success toast
      if (typeof showToast === 'function') {
        showToast(`${lead.name} is now a client!`, 'success');
      }

      console.log(`✅ Converted lead "${lead.name}" to client`);
    } catch (error) {
      console.error('Error converting lead to client:', error);
      if (typeof showToast === 'function') {
        showToast('Error converting to client', 'error');
      }
    }
  }

  // Initialize pipeline and sidebar
  renderCrmPipeSidebar();
  renderPipeline();

  // ==========================================
  // File Integration Buttons
  // ==========================================
  const googleDriveBtn = document.getElementById('googleDriveBtn');
  const oneDriveBtn = document.getElementById('oneDriveBtn');

  if (googleDriveBtn) {
    googleDriveBtn.addEventListener('click', () => {
      const url = 'https://drive.google.com';
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(url);
      } else {
        window.open(url, '_blank');
      }
    });
  }

  if (oneDriveBtn) {
    oneDriveBtn.addEventListener('click', () => {
      const url = 'https://onedrive.live.com';
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(url);
      } else {
        window.open(url, '_blank');
      }
    });
  }

  // ==========================================
  // Admiral Chat Modal (opens when Admiral logo is clicked)
  // ==========================================
  const admiralChatModal = document.getElementById('admiralChatModal');
  const closeAdmiralChatModal = document.getElementById('closeAdmiralChatModal');
  const admiralLogo = document.querySelector('.logo-container');
  const mainChatMessages = document.getElementById('chatMessages');
  const admiralChatMessages = document.getElementById('admiralChatMessages');
  const admiralChatInput = document.getElementById('admiralChatInput');
  const admiralChatSendBtn = document.getElementById('admiralChatSendBtn');
  const admiralChatUploadBtn = document.getElementById('admiralChatUploadBtn');
  const admiralChatFileInput = document.getElementById('admiralChatFileInput');

  // Open Admiral chat modal when logo is clicked
  if (admiralLogo && admiralChatModal) {
    admiralLogo.addEventListener('click', () => {
      // Sync messages from main chat to modal
      if (mainChatMessages && admiralChatMessages) {
        admiralChatMessages.innerHTML = mainChatMessages.innerHTML;
        admiralChatMessages.scrollTop = admiralChatMessages.scrollHeight;
      }
      admiralChatModal.classList.add('active');
      if (admiralChatInput) admiralChatInput.focus();
    });
  }

  if (closeAdmiralChatModal) {
    closeAdmiralChatModal.addEventListener('click', () => {
      admiralChatModal.classList.remove('active');
    });
  }

  if (admiralChatModal) {
    admiralChatModal.addEventListener('click', (e) => {
      if (e.target === admiralChatModal) {
        admiralChatModal.classList.remove('active');
      }
    });
  }

  // Handle sending messages from modal
  if (admiralChatSendBtn && admiralChatInput) {
    const sendAdmiralMessage = async () => {
      const message = admiralChatInput.value.trim();
      if (!message) return;

      // Add user message to modal
      const userMessageDiv = document.createElement('div');
      userMessageDiv.className = 'chat-message user';
      userMessageDiv.innerHTML = `
        <div class="message-avatar">👤</div>
        <div class="message-bubble">
          <div class="message-text">${message}</div>
        </div>
      `;
      admiralChatMessages.appendChild(userMessageDiv);

      // Also add to main chat
      if (mainChatMessages) {
        mainChatMessages.appendChild(userMessageDiv.cloneNode(true));
        mainChatMessages.scrollTop = mainChatMessages.scrollHeight;
      }

      admiralChatInput.value = '';
      admiralChatMessages.scrollTop = admiralChatMessages.scrollHeight;

      // Send to AI and get response (using existing chat functionality if available)
      try {
        if (window.sendToAI) {
          const response = await window.sendToAI(message);
          const assistantDiv = document.createElement('div');
          assistantDiv.className = 'chat-message assistant';
          assistantDiv.innerHTML = `
            <div class="message-avatar"><img src="Assets/Admiral.png" class="admiral-avatar" alt="Admiral"></div>
            <div class="message-bubble">
              <div class="message-text">${response}</div>
            </div>
          `;
          admiralChatMessages.appendChild(assistantDiv);
          if (mainChatMessages) {
            mainChatMessages.appendChild(assistantDiv.cloneNode(true));
            mainChatMessages.scrollTop = mainChatMessages.scrollHeight;
          }
          admiralChatMessages.scrollTop = admiralChatMessages.scrollHeight;
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    };

    admiralChatSendBtn.addEventListener('click', sendAdmiralMessage);
    admiralChatInput.addEventListener('keydown', (e) => {
      // Enter sends message, Shift+Enter adds new line
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAdmiralMessage();
      }
    });
  }

  // Handle file upload in modal
  if (admiralChatUploadBtn && admiralChatFileInput) {
    admiralChatUploadBtn.addEventListener('click', () => admiralChatFileInput.click());
    admiralChatFileInput.addEventListener('change', (e) => {
      // Handle file upload similarly to main chat
      const files = Array.from(e.target.files);
      files.forEach(file => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'chat-message user';
        fileDiv.innerHTML = `
          <div class="message-avatar">👤</div>
          <div class="message-bubble">
            <div class="message-text">📎 Uploaded: ${file.name}</div>
          </div>
        `;
        admiralChatMessages.appendChild(fileDiv);
        if (mainChatMessages) {
          mainChatMessages.appendChild(fileDiv.cloneNode(true));
        }
      });
      admiralChatMessages.scrollTop = admiralChatMessages.scrollHeight;
      admiralChatFileInput.value = '';
    });
  }

  // ============================================
  // FLIGHT TRACKER - Input Fields Version
  // ============================================
  const addFlightBtn = document.getElementById('addFlightBtn');
  const flightDepartureCityInput = document.getElementById('flightDepartureCity');
  const flightArrivalCityInput = document.getElementById('flightArrivalCity');
  const flightDepartureTimeInput = document.getElementById('flightDepartureTime');
  const flightArrivalTimeInput = document.getElementById('flightArrivalTime');
  const flightNumInput = document.getElementById('flightNumber');

  // Store tracked flights in memory (persisted to localStorage)
  let trackedFlightsData = JSON.parse(localStorage.getItem('trackedFlightsData') || '[]');

  function saveTrackedFlights() {
    localStorage.setItem('trackedFlightsData', JSON.stringify(trackedFlightsData));
  }

  function renderTrackedFlights() {
    const listElement = document.getElementById('trackedFlightsList');
    if (!listElement) return;

    if (trackedFlightsData.length === 0) {
      listElement.innerHTML = '<div class="no-flights-message">No flights tracked. Add a flight using the form.</div>';
      return;
    }

    listElement.innerHTML = trackedFlightsData.map((flight, index) => `
      <div class="tracked-flight-item" data-index="${index}">
        <div class="tracked-flight-info">
          <div class="tracked-flight-number">${flight.flightNumber || 'Flight'}</div>
          <div class="tracked-flight-route">${flight.departureCity || ''} → ${flight.arrivalCity || ''}</div>
          <div class="tracked-flight-time">${flight.departureTime || 'N/A'} → ${flight.arrivalTime || 'N/A'}</div>
        </div>
        <div class="tracked-flight-actions">
          <button class="flight-remove-btn" data-index="${index}">✕</button>
        </div>
      </div>
    `).join('');

    // Add click handlers for remove buttons
    listElement.querySelectorAll('.flight-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        trackedFlightsData.splice(index, 1);
        saveTrackedFlights();
        renderTrackedFlights();
      });
    });
  }

  // Add flight from input fields
  async function addFlightFromInputs() {
    const departureCity = flightDepartureCityInput?.value.trim();
    const arrivalCity = flightArrivalCityInput?.value.trim();
    const departureTime = flightDepartureTimeInput?.value.trim();
    const arrivalTime = flightArrivalTimeInput?.value.trim();
    const flightNumber = flightNumInput?.value.trim().toUpperCase() || `${departureCity}-${arrivalCity}`;

    if (!departureCity || !arrivalCity) {
      alert('Please enter both departure and arrival cities.');
      return;
    }

    // Check if flight already exists and remove it
    const existingIndex = trackedFlightsData.findIndex(f =>
      f.flightNumber && f.flightNumber.toUpperCase() === flightNumber
    );
    if (existingIndex !== -1) {
      trackedFlightsData.splice(existingIndex, 1);
    }

    // Add new flight data
    const flightData = {
      flightNumber,
      departureCity,
      arrivalCity,
      departureTime: departureTime || 'TBD',
      arrivalTime: arrivalTime || 'TBD',
      route: `${departureCity} → ${arrivalCity}`,
      addedAt: new Date().toISOString()
    };

    trackedFlightsData.unshift(flightData);
    saveTrackedFlights();
    renderTrackedFlights();

    // Add flight to map
    await addFlightToMap(flightData);

    // Clear inputs
    if (flightDepartureCityInput) flightDepartureCityInput.value = '';
    if (flightArrivalCityInput) flightArrivalCityInput.value = '';
    if (flightDepartureTimeInput) flightDepartureTimeInput.value = '';
    if (flightArrivalTimeInput) flightArrivalTimeInput.value = '';
    if (flightNumInput) flightNumInput.value = '';

    console.log(`✈️ Flight ${flightNumber} added to tracked flights`);
  }

  // Add flight to map using city lookup
  async function addFlightToMap(flightData) {
    if (!window.mapIntegration || !window.airportDatabase) {
      console.log('Map integration or airport database not available');
      return;
    }

    // Ensure airport database is loaded
    await window.airportDatabase.load();

    // Search airports by city name
    const originResults = window.airportDatabase.searchAirports(flightData.departureCity);
    const destResults = window.airportDatabase.searchAirports(flightData.arrivalCity);

    if (originResults.length === 0 || destResults.length === 0) {
      console.log('Could not find airports for cities:', flightData.departureCity, flightData.arrivalCity);
      return;
    }

    const origin = originResults[0];
    const destination = destResults[0];

    // Add to map using existing map integration
    await window.mapIntegration.addFlightWithCities({
      flightNumber: flightData.flightNumber,
      origin: origin,
      destination: destination,
      departureTime: flightData.departureTime,
      arrivalTime: flightData.arrivalTime
    });

    console.log(`✈️ Flight ${flightData.flightNumber} added to map: ${origin.city} → ${destination.city}`);
  }

  // Add flight button handler
  if (addFlightBtn) {
    addFlightBtn.addEventListener('click', addFlightFromInputs);
  }

  // Clear all flights button handler
  const clearAllFlightsBtn = document.getElementById('clearAllFlightsBtn');
  if (clearAllFlightsBtn) {
    clearAllFlightsBtn.addEventListener('click', () => {
      trackedFlightsData = [];
      saveTrackedFlights();
      renderTrackedFlights();
    });
  }

  // Initial render of tracked flights
  renderTrackedFlights();

  // ============================================
  // FILES VIEW - Aggregate all files from disk storage
  // ============================================

  // Load and display storage settings
  async function loadStorageSettings() {
    const storagePath = document.getElementById('storagePath');
    if (!storagePath) {
      console.log('storagePath element not found');
      return;
    }

    console.log('Loading storage settings...');
    console.log('electronAPI available:', !!window.electronAPI);
    console.log('getStorageSettings available:', !!(window.electronAPI && window.electronAPI.getStorageSettings));

    if (window.electronAPI && window.electronAPI.getStorageSettings) {
      try {
        const result = await window.electronAPI.getStorageSettings();
        console.log('Storage settings result:', result);
        if (result.success) {
          storagePath.textContent = result.storageFolder;
          storagePath.title = `Click to open: ${result.storageFolder}`;
        } else {
          storagePath.textContent = 'Error: ' + (result.error || 'Unknown error');
        }
      } catch (error) {
        console.error('Error loading storage settings:', error);
        storagePath.textContent = 'Error: ' + error.message;
      }
    } else {
      storagePath.textContent = 'Not available (requires Electron)';
    }
  }

  // Storage settings button handlers
  document.getElementById('changeStorageBtn')?.addEventListener('click', async () => {
    if (!window.electronAPI?.selectStorageFolder) {
      showToast('Storage selection not available', 'error');
      return;
    }

    const result = await window.electronAPI.selectStorageFolder();
    if (result.success) {
      showToast('Storage folder updated!', 'success');
      loadStorageSettings();
      allFilesCache = []; // Clear cache
      renderFilesView(); // Refresh files view
    } else if (!result.canceled) {
      showToast(result.error || 'Failed to set storage folder', 'error');
    }
  });

  document.getElementById('openStorageBtn')?.addEventListener('click', async () => {
    if (!window.electronAPI?.openStorageFolder) {
      showToast('Cannot open folder', 'error');
      return;
    }

    const result = await window.electronAPI.openStorageFolder();
    if (!result.success) {
      showToast(result.error || 'Failed to open folder', 'error');
    }
  });

  // Add File to Misc folder
  const addMiscFileBtn = document.getElementById('addMiscFileBtn');
  const miscFileInput = document.getElementById('miscFileInput');

  if (addMiscFileBtn && miscFileInput) {
    addMiscFileBtn.addEventListener('click', () => {
      miscFileInput.click();
    });

    miscFileInput.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      if (!window.electronAPI?.saveFile) {
        showToast('File storage not available', 'error');
        return;
      }

      for (const file of files) {
        try {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const result = await window.electronAPI.saveFile({
              fileName: file.name,
              fileData: event.target.result, // Already has data: prefix from readAsDataURL
              fileType: file.type || 'application/octet-stream',
              fileSize: file.size,
              ownerType: 'misc',
              ownerId: 'misc',
              ownerName: 'Misc'
            });

            if (result.success) {
              showToast(`Added: ${file.name}`, 'success');
              // Refresh files view
              if (typeof window.refreshFilesView === 'function') {
                window.refreshFilesView();
              }
            } else {
              showToast(`Failed to add: ${file.name}`, 'error');
            }
          };
          reader.readAsDataURL(file);
        } catch (error) {
          console.error('Error adding file:', error);
          showToast(`Error adding: ${file.name}`, 'error');
        }
      }

      // Clear the input
      miscFileInput.value = '';
    });
  }

  // Click on storage path to open folder
  document.getElementById('storagePath')?.addEventListener('click', async () => {
    if (window.electronAPI?.openStorageFolder) {
      await window.electronAPI.openStorageFolder();
    }
  });

  // Load storage settings on page load
  loadStorageSettings();

  // Get all files from disk (via Electron API)
  async function getAllFilesFromDisk() {
    if (window.electronAPI && window.electronAPI.getAllFiles) {
      try {
        const result = await window.electronAPI.getAllFiles();
        if (result.success) {
          // Add owner names from localStorage for client/employee/lead types
          // Keep the backend-provided ownerName for other types
          const clients = JSON.parse(localStorage.getItem('cfo_clients') || '[]');
          const employees = JSON.parse(localStorage.getItem('cfo_employees') || '[]');
          const leads = JSON.parse(localStorage.getItem('crm_pipeline') || '[]');

          return result.files.map(file => {
            // Start with the backend-provided ownerName, fall back to ownerId
            let ownerName = file.ownerName || file.ownerId;

            // Only override for types where we need to look up names from localStorage
            if (file.ownerType === 'client') {
              const client = clients.find(c => c.id === file.ownerId);
              ownerName = client?.name || file.ownerName || file.ownerId;
            } else if (file.ownerType === 'employee') {
              const employee = employees.find(e => e.id === file.ownerId);
              ownerName = employee?.name || file.ownerName || file.ownerId;
            } else if (file.ownerType === 'lead') {
              const lead = leads.find(l => l.id === file.ownerId);
              ownerName = lead?.name || lead?.company || file.ownerName || file.ownerId;
            }
            // For transcription, sheets, quickbooks, misc - keep the backend-provided ownerName
            return { ...file, ownerName };
          });
        }
      } catch (error) {
        console.error('Error getting all files:', error);
      }
    }
    return [];
  }

  // Delete a file from disk storage
  async function deleteFileFromDisk(ownerType, ownerId, safeName, ownerName = null) {
    console.log('🗑️ deleteFileFromDisk called:', { ownerType, ownerId, safeName, ownerName });
    if (window.electronAPI && window.electronAPI.deleteFile) {
      try {
        const result = await window.electronAPI.deleteFile({ ownerType, ownerId, ownerName, safeName });
        console.log('🗑️ Delete result:', result);
        return result.success;
      } catch (error) {
        console.error('🗑️ Error deleting file:', error);
        return false;
      }
    }
    console.log('🗑️ electronAPI.deleteFile not available');
    return false;
  }


  // Format date for display
  function formatFileDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isThisYear = date.getFullYear() === now.getFullYear();

    if (isToday) {
      return 'Today';
    } else if (isThisYear) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  // Get owner type label
  function getOwnerTypeLabel(type) {
    switch (type) {
      case 'client': return '👤 Client';
      case 'employee': return '👔 Employee';
      case 'lead': return '📈 Lead';
      case 'sheets': return '📊 Google Sheets';
      case 'quickbooks': return '💰 QuickBooks';
      case 'misc': return '📂 Misc';
      default: return '📁';
    }
  }

  // Store all files for filtering
  let allFilesCache = [];

  // Global refresh function for files view
  window.refreshFilesView = function() {
    allFilesCache = [];
    renderFilesView();
  };

  // Get current filter values
  function getFileFilters() {
    return {
      search: document.getElementById('fileSearch')?.value || '',
      ownerType: document.getElementById('fileOwnerTypeFilter')?.value || 'all',
      owner: document.getElementById('fileOwnerFilter')?.value || 'all'
    };
  }

  // Update owner filter dropdown based on selected type
  function updateOwnerFilterOptions(files, selectedType) {
    const ownerFilter = document.getElementById('fileOwnerFilter');
    if (!ownerFilter) return;

    // Get unique owners for the selected type
    const owners = new Map();
    files.forEach(file => {
      if (selectedType === 'all' || file.ownerType === selectedType) {
        const key = `${file.ownerType}-${file.ownerId}`;
        if (!owners.has(key)) {
          owners.set(key, {
            id: file.ownerId,
            name: file.ownerName,
            type: file.ownerType
          });
        }
      }
    });

    // Build options
    let options = '<option value="all">All Folders</option>';
    owners.forEach((owner, key) => {
      const typeIcons = {
        'client': '👤',
        'employee': '👔',
        'lead': '📈',
        'sheets': '📊',
        'quickbooks': '💰'
      };
      const typeIcon = typeIcons[owner.type] || '📁';
      options += `<option value="${key}">${typeIcon} ${owner.name}</option>`;
    });

    ownerFilter.innerHTML = options;
  }

  // Update file stats display
  function updateFileStats(totalFiles, filteredCount) {
    const statsEl = document.getElementById('fileFilterStats');
    if (statsEl) {
      if (totalFiles === filteredCount) {
        statsEl.textContent = `${totalFiles} file${totalFiles !== 1 ? 's' : ''}`;
      } else {
        statsEl.textContent = `${filteredCount} of ${totalFiles} files`;
      }
    }
  }

  // Render files view (async to load from disk)
  async function renderFilesView() {
    const filesGrid = document.getElementById('filesGrid');
    if (!filesGrid) return;

    // Show loading
    filesGrid.innerHTML = '<div class="no-files-message">Loading files...</div>';

    // Fetch all files if cache is empty
    if (allFilesCache.length === 0) {
      allFilesCache = await getAllFilesFromDisk();
      // Update owner filter options
      updateOwnerFilterOptions(allFilesCache, 'all');
    }

    const filters = getFileFilters();

    // Filter files
    let filteredFiles = allFilesCache;

    // Filter by owner type
    if (filters.ownerType !== 'all') {
      filteredFiles = filteredFiles.filter(f => f.ownerType === filters.ownerType);
    }

    // Filter by specific owner
    if (filters.owner !== 'all') {
      filteredFiles = filteredFiles.filter(f => `${f.ownerType}-${f.ownerId}` === filters.owner);
    }

    // Filter by search term
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredFiles = filteredFiles.filter(file =>
        file.name.toLowerCase().includes(searchLower) ||
        file.ownerName.toLowerCase().includes(searchLower)
      );
    }

    // Update stats
    updateFileStats(allFilesCache.length, filteredFiles.length);

    if (filteredFiles.length === 0) {
      filesGrid.innerHTML = `
        <div class="no-files-message">
          ${filters.search || filters.ownerType !== 'all' || filters.owner !== 'all'
            ? 'No files match your filters.'
            : 'No files uploaded yet. Attach files to clients, employees, or CRM leads to see them here.'}
        </div>
      `;
      return;
    }

    // Group files by owner
    const filesByOwner = {};
    filteredFiles.forEach(file => {
      const key = `${file.ownerType}-${file.ownerId}`;
      if (!filesByOwner[key]) {
        filesByOwner[key] = {
          ownerName: file.ownerName,
          ownerType: file.ownerType,
          ownerId: file.ownerId,
          files: []
        };
      }
      filesByOwner[key].files.push(file);
    });

    // Render grouped files
    filesGrid.innerHTML = Object.values(filesByOwner).map(group => `
      <div class="file-group">
        <div class="file-group-header">
          <span class="file-group-type">${getOwnerTypeLabel(group.ownerType)}</span>
          <span class="file-group-name">${group.ownerName}</span>
        </div>
        ${group.files.map(file => `
          <div class="file-item" data-owner-type="${file.ownerType}" data-owner-id="${file.ownerId}" data-owner-name="${file.ownerName || ''}" data-safe-name="${file.safeName}" data-file-path="${file.path}" data-file-name="${file.name}">
            <span class="file-icon">${getFileIcon(file.type)}</span>
            <span class="file-name">${file.name}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
            <span class="file-date">${formatFileDate(file.uploadDate)}</span>
            <button class="file-delete-btn" title="Delete file">✕</button>
          </div>
        `).join('')}
      </div>
    `).join('');

    // Attach delete handlers with styled modal
    filesGrid.querySelectorAll('.file-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fileItem = btn.closest('.file-item');
        const ownerType = fileItem.dataset.ownerType;
        const ownerId = fileItem.dataset.ownerId;
        const ownerName = fileItem.dataset.ownerName || null;
        const safeName = fileItem.dataset.safeName;
        const fileName = fileItem.dataset.fileName;

        console.log('🗑️ Files section delete clicked:', { ownerType, ownerId, ownerName, safeName, fileName });

        const confirmed = await showConfirmModal({
          icon: '🗑️',
          title: 'Delete File',
          message: 'Are you sure you want to delete this file?',
          details: fileName,
          confirmText: 'Delete',
          cancelText: 'Cancel',
          type: 'danger'
        });

        console.log('🗑️ User confirmed:', confirmed);

        if (confirmed) {
          const success = await deleteFileFromDisk(ownerType, ownerId, safeName, ownerName);
          console.log('🗑️ Delete success:', success);
          if (success) {
            showToast(`File "${fileName}" deleted`, 'success');
            // Clear cache to force reload and update owner filter dropdown
            allFilesCache = [];
            await renderFilesView();
            // Re-update owner filter with current type selection
            const currentType = document.getElementById('fileOwnerTypeFilter')?.value || 'all';
            updateOwnerFilterOptions(allFilesCache, currentType);
          } else {
            showToast('Error deleting file', 'error');
          }
        }
      });
    });

    // Attach click handlers for file preview/download
    filesGrid.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if (e.target.classList.contains('file-delete-btn')) return;

        const filePath = item.dataset.filePath;
        const fileName = item.dataset.fileName || 'file';

        if (filePath && window.electronAPI?.openFile) {
          // Open file using Electron shell (opens in default application)
          const result = await window.electronAPI.openFile(filePath);
          if (result.success) {
            showToast(`Opening "${fileName}"`, 'info');
          } else {
            showToast(`Failed to open file: ${result.error}`, 'error');
          }
        } else {
          showToast('File cannot be opened', 'error');
        }
      });
    });
  }

  // Refresh files cache (call after uploading new files)
  function refreshFilesCache() {
    allFilesCache = [];
  }

  // Initialize files view on nav click
  const filesNavBtn = document.querySelector('[data-view="files"]');
  if (filesNavBtn) {
    filesNavBtn.addEventListener('click', () => {
      refreshFilesCache();
      renderFilesView();
    });
  }

  // File search functionality - triggered by button click
  const fileSearchInput = document.getElementById('fileSearch');
  const fileSearchBtn = document.getElementById('fileSearchBtn');

  if (fileSearchBtn) {
    fileSearchBtn.addEventListener('click', () => {
      renderFilesView();
    });
  }

  // Also allow Enter key to trigger search
  if (fileSearchInput) {
    fileSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        renderFilesView();
      }
    });
  }

  // Clear search button
  const fileClearSearchBtn = document.getElementById('fileClearSearchBtn');
  if (fileClearSearchBtn) {
    fileClearSearchBtn.addEventListener('click', () => {
      if (fileSearchInput) {
        fileSearchInput.value = '';
      }
      renderFilesView();
    });
  }

  // Owner type filter
  const ownerTypeFilter = document.getElementById('fileOwnerTypeFilter');
  if (ownerTypeFilter) {
    ownerTypeFilter.addEventListener('change', () => {
      // Update the owner filter dropdown based on selected type
      updateOwnerFilterOptions(allFilesCache, ownerTypeFilter.value);
      // Reset owner filter to "all"
      const ownerFilter = document.getElementById('fileOwnerFilter');
      if (ownerFilter) ownerFilter.value = 'all';
      renderFilesView();
    });
  }

  // Owner filter
  const ownerFilter = document.getElementById('fileOwnerFilter');
  if (ownerFilter) {
    ownerFilter.addEventListener('change', () => {
      renderFilesView();
    });
  }

  console.log('✅ Dashboard fully initialized');
});
