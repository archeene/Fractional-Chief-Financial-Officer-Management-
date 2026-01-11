# Android Contacts Import - Implementation Guide

## Overview

This document outlines three methods for importing Android contacts into THE HULL call center system.

---

## Method 1: Google Contacts API (Recommended)

### Benefits
- Real-time synchronization
- Automatic updates when contacts change
- Works across all devices with same Google account
- Most reliable and user-friendly

### Implementation Steps

**1. Enable Google Contacts API:**
- Go to Google Cloud Console: https://console.cloud.google.com
- Enable "People API" (includes Contacts)
- Add to existing OAuth credentials

**2. Add Required Scopes:**
```javascript
// In server.js, add to OAuth scopes:
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/contacts.readonly'  // Add this
];
```

**3. Fetch Contacts:**
```javascript
// Add to server.js
const { google } = require('googleapis');

async function getContacts(auth) {
  const people = google.people({ version: 'v1', auth });

  const response = await people.people.connections.list({
    resourceName: 'people/me',
    personFields: 'names,emailAddresses,phoneNumbers,photos,organizations',
    pageSize: 1000
  });

  const contacts = response.data.connections || [];

  return contacts.map(contact => ({
    name: contact.names?.[0]?.displayName || 'Unknown',
    email: contact.emailAddresses?.[0]?.value || '',
    phone: contact.phoneNumbers?.[0]?.value || '',
    company: contact.organizations?.[0]?.name || '',
    photo: contact.photos?.[0]?.url || ''
  }));
}

// Add IPC handler in main.js
ipcMain.handle('get-contacts', async () => {
  const auth = await getAuthClient();
  return await getContacts(auth);
});
```

**4. Display in Dashboard:**
```javascript
// In dashboard.js
async function syncContacts() {
  try {
    const contacts = await window.electronAPI.getContacts();

    // Display contacts in UI
    displayContactsList(contacts);

    // Save to localStorage or IndexedDB
    localStorage.setItem('contacts', JSON.stringify(contacts));

    console.log(`✅ Synced ${contacts.length} contacts`);
  } catch (error) {
    console.error('❌ Contact sync failed:', error);
  }
}
```

---

## Method 2: vCard (.vcf) File Import

### Benefits
- No API setup required
- Works offline
- Simple one-time import

### Implementation Steps

**1. Export from Android:**
- Open Contacts app
- Menu → Export → vCard (.vcf file)
- Save to Downloads or email to yourself

**2. Add File Picker to Dashboard:**
```html
<!-- In dashboard.html -->
<input type="file" id="vcfFileInput" accept=".vcf" style="display: none;">
<button class="panel-btn" id="importVcfBtn">IMPORT CONTACTS</button>
```

**3. Parse vCard File:**
```javascript
// In dashboard.js
const importVcfBtn = document.getElementById('importVcfBtn');
const vcfFileInput = document.getElementById('vcfFileInput');

importVcfBtn.addEventListener('click', () => {
  vcfFileInput.click();
});

vcfFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  const contacts = parseVCard(text);

  localStorage.setItem('contacts', JSON.stringify(contacts));
  displayContactsList(contacts);

  console.log(`✅ Imported ${contacts.length} contacts`);
});

function parseVCard(vcfText) {
  const contacts = [];
  const vCards = vcfText.split('END:VCARD');

  vCards.forEach(vcard => {
    if (!vcard.trim()) return;

    const contact = {
      name: extractField(vcard, 'FN'),
      email: extractField(vcard, 'EMAIL'),
      phone: extractField(vcard, 'TEL'),
      company: extractField(vcard, 'ORG')
    };

    if (contact.name) {
      contacts.push(contact);
    }
  });

  return contacts;
}

function extractField(vcard, field) {
  const regex = new RegExp(`${field}[^:]*:(.*)`, 'i');
  const match = vcard.match(regex);
  return match ? match[1].trim() : '';
}
```

---

## Method 3: CardDAV Protocol

### Benefits
- Industry standard
- Works with any CardDAV-compatible server
- Two-way sync possible

### Implementation Steps

**1. Install CardDAV Library:**
```bash
npm install dav
```

**2. Configure CardDAV Connection:**
```javascript
// In server.js or separate contacts-sync.js
const dav = require('dav');

async function syncCardDAV(serverUrl, username, password) {
  const xhr = new dav.transport.Basic(
    new dav.Credentials({ username, password })
  );

  const account = await dav.createAccount({
    server: serverUrl,
    xhr: xhr,
    loadCollections: true
  });

  const addressBooks = account.addressBooks;
  const contacts = [];

  for (const book of addressBooks) {
    const objects = await dav.syncCollection(book, {
      xhr: xhr,
      syncMethod: 'basic'
    });

    objects.forEach(obj => {
      // Parse vCard from obj.addressData
      const contact = parseVCardData(obj.addressData);
      contacts.push(contact);
    });
  }

  return contacts;
}
```

**3. Common CardDAV Servers:**
- **Google Contacts**: `https://www.googleapis.com/.well-known/carddav`
- **iCloud**: `https://contacts.icloud.com`
- **Nextcloud**: `https://your-server.com/remote.php/dav`
- **Radicale**: Self-hosted option

---

## Recommended Implementation Plan

### Phase 1: Basic Import (Easiest)
1. Implement vCard file import
2. Add contact list UI
3. Store in localStorage

### Phase 2: Google Sync (Recommended)
1. Add Google People API to OAuth
2. Implement contact fetching
3. Auto-sync every 30 minutes
4. Display sync status

### Phase 3: Advanced (Optional)
1. Add CardDAV support for custom servers
2. Two-way sync (edit contacts in THE HULL)
3. Contact groups/tags
4. Search and filter

---

## UI/UX Considerations

### Contact List Display
```javascript
function displayContactsList(contacts) {
  const container = document.getElementById('contactsList');
  container.innerHTML = '';

  contacts.forEach(contact => {
    const item = document.createElement('div');
    item.className = 'contact-item';
    item.innerHTML = `
      <img src="${contact.photo || 'Assets/default-avatar.png'}" class="contact-avatar">
      <div class="contact-info">
        <div class="contact-name">${contact.name}</div>
        <div class="contact-details">${contact.phone || contact.email}</div>
        ${contact.company ? `<div class="contact-company">${contact.company}</div>` : ''}
      </div>
      <div class="contact-actions">
        <button class="call-btn-small" onclick="callContact('${contact.phone}')">📞</button>
        <button class="call-btn-small" onclick="videoCallContact('${contact.email}')">📹</button>
      </div>
    `;
    container.appendChild(item);
  });
}
```

### Search Functionality
```javascript
function searchContacts(query) {
  const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');

  return contacts.filter(contact => {
    const searchText = `${contact.name} ${contact.email} ${contact.phone} ${contact.company}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  });
}
```

---

## Data Privacy & Security

**Important Considerations:**

1. **Encryption**: Encrypt contacts in localStorage
   ```javascript
   // Simple encryption (use crypto library in production)
   function encryptContacts(contacts) {
     const json = JSON.stringify(contacts);
     // Use Web Crypto API or crypto library
     return btoa(json); // Basic example
   }
   ```

2. **User Consent**: Always ask permission before syncing
3. **Data Retention**: Provide option to delete all synced contacts
4. **OAuth Scopes**: Only request necessary permissions

---

## Testing Checklist

- [ ] Export contacts from Android device
- [ ] Test vCard import with sample file
- [ ] Verify contact data parsing (name, phone, email)
- [ ] Test Google Contacts API sync
- [ ] Check contact list display
- [ ] Test search functionality
- [ ] Verify localStorage persistence
- [ ] Test call/video buttons with contacts

---

## Example vCard for Testing

```
BEGIN:VCARD
VERSION:3.0
FN:John Doe
N:Doe;John;;;
EMAIL;TYPE=INTERNET:john@example.com
TEL;TYPE=CELL:+1-555-123-4567
ORG:Example Corp
END:VCARD
```

---

## Resources

- **Google People API**: https://developers.google.com/people
- **vCard Format**: https://en.wikipedia.org/wiki/VCard
- **CardDAV Protocol**: https://en.wikipedia.org/wiki/CardDAV
- **DAV Library**: https://github.com/lambdabaa/dav

---

## Next Steps

1. Choose implementation method (recommend starting with vCard)
2. Add UI for contact list in Call Center panel
3. Implement contact storage (localStorage or IndexedDB)
4. Add search/filter functionality
5. Integrate with call buttons
6. (Optional) Add Google Contacts API sync

**Ready to implement when needed!**
