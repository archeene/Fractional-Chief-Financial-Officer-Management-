// Email Module - Gmail OAuth Integration
// Extracted from dashboard.js for better code organization

(function() {
  'use strict';

  // ==========================================
  // Email View - Gmail OAuth Integration
  // ==========================================
  const emailLoginSection = document.getElementById('emailLoginSection');
  const emailMainView = document.getElementById('emailMainView');
  const emailGmailLoginBtn = document.getElementById('emailGmailLoginBtn');
  const emailRefreshBtn = document.getElementById('emailRefreshBtn');
  const emailComposeBtn = document.getElementById('emailComposeBtn');
  const emailFolders = document.querySelectorAll('.email-folder');
  const emailList = document.getElementById('emailListView');
  const composeEmailModal = document.getElementById('composeEmailModal');
  const emailDetailModal = document.getElementById('emailDetailModal');
  const closeEmailDetailModal = document.getElementById('closeEmailDetailModal');

  let currentFolder = 'INBOX';
  let currentEmails = [];
  let currentEmailData = null;
  let gmailLabels = []; // Store Gmail labels for the label picker

  // Helper to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Check Gmail auth status on load
  async function checkGmailAuth() {
    try {
      const response = await fetch('http://localhost:3001/api/gmail/profile');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('✅ Gmail authenticated:', data.email);
          if (emailLoginSection) emailLoginSection.style.display = 'none';
          if (emailMainView) emailMainView.style.display = 'grid';
          // Load labels first, then emails
          await loadGmailLabels();
          loadEmails(currentFolder);
          return true;
        }
      }
    } catch (error) {
      console.log('Gmail not authenticated yet');
    }
    return false;
  }

  // Load Gmail labels and populate the sidebar
  async function loadGmailLabels() {
    try {
      const response = await fetch('http://localhost:3001/api/gmail/labels');
      const data = await response.json();

      if (data.success && data.labels) {
        gmailLabels = data.labels;
        console.log('📧 Loaded Gmail labels:', gmailLabels.length);

        // Get hidden labels from localStorage
        const hiddenLabels = JSON.parse(localStorage.getItem('hidden_gmail_labels') || '[]');

        // Filter to user-created labels (not system labels), excluding hidden ones
        const customLabels = gmailLabels.filter(label => {
          // Exclude system labels
          const systemLabels = ['INBOX', 'SENT', 'DRAFT', 'TRASH', 'SPAM', 'STARRED', 'UNREAD', 'IMPORTANT', 'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS', 'CHAT'];
          // Also exclude hidden labels
          if (hiddenLabels.includes(label.id)) return false;
          return label.type === 'user' || (!systemLabels.includes(label.id) && !label.id.startsWith('CATEGORY_'));
        });

        // Add custom labels to sidebar
        const customLabelsContainer = document.getElementById('customLabelsContainer');
        const customLabelsHeader = document.getElementById('customLabelsHeader');
        const labelsDivider = document.getElementById('labelsDivider');

        if (customLabels.length > 0 && customLabelsContainer) {
          if (labelsDivider) labelsDivider.style.display = 'block';
          customLabelsHeader.style.display = 'block';
          customLabelsContainer.innerHTML = customLabels.map(label => {
            const labelName = label.name.replace(/^.*\//, ''); // Get last part if nested
            const bgColor = label.color?.backgroundColor || '#00ff41';
            return `
              <div class="custom-label-folder-wrapper">
                <button class="custom-label-folder" data-label-id="${label.id}" data-folder="${label.id}">
                  <span class="label-color-dot" style="background: ${bgColor}"></span>
                  <span class="folder-name">${escapeHtml(labelName)}</span>
                </button>
                <button class="remove-label-btn" data-label-id="${label.id}" title="Remove from sidebar">✕</button>
              </div>
            `;
          }).join('');

          // Add click handlers for custom labels
          customLabelsContainer.querySelectorAll('.custom-label-folder').forEach(btn => {
            btn.addEventListener('click', () => {
              document.querySelectorAll('.email-folder, .custom-label-folder').forEach(f => f.classList.remove('active'));
              btn.classList.add('active');
              const labelId = btn.dataset.labelId;
              currentFolder = labelId;
              console.log('Switching to custom label:', labelId);
              loadEmails(labelId);
            });
          });

          // Add click handlers for remove label buttons
          customLabelsContainer.querySelectorAll('.remove-label-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const labelId = btn.dataset.labelId;
              const labelName = gmailLabels.find(l => l.id === labelId)?.name || labelId;

              if (confirm(`Remove "${labelName}" from sidebar?\n\nThis only hides the label from the sidebar - it won't delete the label from Gmail.`)) {
                // Store hidden labels in localStorage
                const hiddenLabels = JSON.parse(localStorage.getItem('hidden_gmail_labels') || '[]');
                if (!hiddenLabels.includes(labelId)) {
                  hiddenLabels.push(labelId);
                  localStorage.setItem('hidden_gmail_labels', JSON.stringify(hiddenLabels));
                }
                // Reload labels to update sidebar
                await loadGmailLabels();
              }
            });
          });
        }
      }
    } catch (error) {
      console.error('Error loading Gmail labels:', error);
    }
  }

  // Modify email labels
  async function modifyEmailLabels(messageId, addLabelIds = [], removeLabelIds = []) {
    try {
      const response = await fetch(`http://localhost:3001/api/gmail/messages/${messageId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addLabelIds, removeLabelIds })
      });
      const data = await response.json();
      if (data.success) {
        console.log('✅ Labels modified:', data.labelIds);
        return data.labelIds;
      } else {
        throw new Error(data.error || 'Failed to modify labels');
      }
    } catch (error) {
      console.error('Error modifying labels:', error);
      throw error;
    }
  }

  // Show label picker modal
  function showLabelPicker(messageId) {
    // Get hidden labels from localStorage
    const hiddenPickerLabels = JSON.parse(localStorage.getItem('hidden_picker_labels') || '[]');

    // Get all user labels, filter out hidden ones, and sort alphabetically
    const userLabels = gmailLabels
      .filter(label => {
        const systemLabels = ['INBOX', 'SENT', 'DRAFT', 'UNREAD', 'IMPORTANT', 'CHAT', 'STARRED', 'SPAM', 'TRASH'];
        if (systemLabels.includes(label.id)) return false;
        if (label.id.startsWith('CATEGORY_')) return false;
        if (hiddenPickerLabels.includes(label.id)) return false;
        return label.type === 'user';
      })
      .sort((a, b) => {
        const nameA = a.name.replace(/^.*\//, '').toLowerCase();
        const nameB = b.name.replace(/^.*\//, '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'label-picker-modal active';
    modal.innerHTML = `
      <div class="label-picker-content">
        <div class="label-picker-header">
          <span>Apply Label</span>
          <button class="close-label-picker">&times;</button>
        </div>
        <div class="label-picker-list">
          <button class="label-picker-item" data-action="spam">
            <span class="label-icon">⚠️</span>
            <span>Report as Spam</span>
          </button>
          <button class="label-picker-item" data-action="not-spam">
            <span class="label-icon">✅</span>
            <span>Not Spam (move to Inbox)</span>
          </button>
          <div class="label-picker-divider"></div>
          ${userLabels.length > 0 ? userLabels.map(label => {
            const labelName = label.name.replace(/^.*\//, '');
            const bgColor = label.color?.backgroundColor || '#00ff41';
            return `
              <div class="label-picker-item-wrapper" style="display: flex; align-items: center;">
                <button class="label-picker-item" data-label-id="${label.id}" style="flex: 1;">
                  <span class="label-color-dot" style="background: ${bgColor}"></span>
                  <span>${escapeHtml(labelName)}</span>
                </button>
                <button class="hide-label-btn" data-label-id="${label.id}" title="Hide from this list" style="background: none; border: none; color: #ff6666; cursor: pointer; padding: 5px 8px; font-size: 12px;">✕</button>
              </div>
            `;
          }).join('') : '<div style="padding: 10px; color: #888; text-align: center;">No labels available</div>'}
          <div class="label-picker-divider"></div>
          <button class="label-picker-item create-new-label">
            <span class="label-icon">➕</span>
            <span>Create New Label</span>
          </button>
          ${hiddenPickerLabels.length > 0 ? `
            <button class="label-picker-item restore-labels" style="color: #888;">
              <span class="label-icon">↩️</span>
              <span>Restore Hidden Labels (${hiddenPickerLabels.length})</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close button
    modal.querySelector('.close-label-picker').addEventListener('click', () => {
      modal.remove();
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Hide label buttons
    modal.querySelectorAll('.hide-label-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const labelId = btn.dataset.labelId;
        const hidden = JSON.parse(localStorage.getItem('hidden_picker_labels') || '[]');
        if (!hidden.includes(labelId)) {
          hidden.push(labelId);
          localStorage.setItem('hidden_picker_labels', JSON.stringify(hidden));
        }
        // Refresh the picker
        modal.remove();
        showLabelPicker(messageId);
      });
    });

    // Restore hidden labels
    modal.querySelector('.restore-labels')?.addEventListener('click', () => {
      localStorage.setItem('hidden_picker_labels', '[]');
      modal.remove();
      showLabelPicker(messageId);
    });

    // Label actions
    modal.querySelectorAll('.label-picker-item').forEach(item => {
      item.addEventListener('click', async () => {
        const action = item.dataset.action;
        const labelId = item.dataset.labelId;

        try {
          if (action === 'spam') {
            await modifyEmailLabels(messageId, ['SPAM'], ['INBOX']);
            if (typeof showToast === 'function') showToast('Email marked as spam', 'warning');
          } else if (action === 'not-spam') {
            await modifyEmailLabels(messageId, ['INBOX'], ['SPAM']);
            if (typeof showToast === 'function') showToast('Email moved to inbox', 'success');
          } else if (labelId) {
            await modifyEmailLabels(messageId, [labelId], []);
            if (typeof showToast === 'function') showToast(`Label applied: ${item.textContent.trim()}`, 'success');
          } else if (item.classList.contains('create-new-label')) {
            // Show inline input instead of prompt()
            modal.remove();
            showCreateLabelModal(messageId);
            return;
          } else if (item.classList.contains('restore-labels')) {
            return; // Already handled above
          }

          modal.remove();
          // Refresh email list
          loadEmails(currentFolder);
        } catch (error) {
          if (typeof showToast === 'function') showToast('Error: ' + error.message, 'error');
        }
      });
    });
  }

  // Create label modal (replaces prompt())
  function showCreateLabelModal(messageId) {
    const modal = document.createElement('div');
    modal.className = 'label-picker-modal active';
    modal.innerHTML = `
      <div class="label-picker-content" style="max-width: 350px;">
        <div class="label-picker-header">
          <span>Create New Label</span>
          <button class="close-label-picker">&times;</button>
        </div>
        <div style="padding: 20px;">
          <input type="text" id="newLabelInput" placeholder="Enter label name..."
            style="width: 100%; padding: 10px; background: rgba(0,255,65,0.1); border: 1px solid #00ff41; color: #00ff41; font-size: 14px; margin-bottom: 15px;">
          <div style="display: flex; gap: 10px;">
            <button id="createLabelBtn" style="flex: 1; padding: 10px; background: #00ff41; color: #000; border: none; cursor: pointer; font-weight: bold;">Create & Apply</button>
            <button id="cancelLabelBtn" style="flex: 1; padding: 10px; background: transparent; color: #00ff41; border: 1px solid #00ff41; cursor: pointer;">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#newLabelInput');
    input.focus();

    // Close handlers
    modal.querySelector('.close-label-picker').addEventListener('click', () => modal.remove());
    modal.querySelector('#cancelLabelBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Create label
    const createLabel = async () => {
      const newLabel = input.value.trim();
      if (!newLabel) return;

      try {
        const createResponse = await fetch('http://localhost:3001/api/gmail/labels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newLabel })
        });
        const createData = await createResponse.json();
        if (createData.success) {
          // Apply the new label if we have a messageId
          if (messageId) {
            await modifyEmailLabels(messageId, [createData.label.id], []);
          }
          if (typeof showToast === 'function') showToast(`Label "${newLabel}" created${messageId ? ' and applied' : ''}`, 'success');
          // Refresh labels
          await loadGmailLabels();
          loadEmails(currentFolder);
        } else {
          if (typeof showToast === 'function') showToast('Failed to create label: ' + (createData.error || 'Unknown error'), 'error');
        }
      } catch (error) {
        if (typeof showToast === 'function') showToast('Error: ' + error.message, 'error');
      }
      modal.remove();
    };

    modal.querySelector('#createLabelBtn').addEventListener('click', createLabel);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') createLabel();
    });
  }

  // Spam detection patterns
  const SPAM_PATTERNS = {
    subjects: [
      /lottery/i, /winner/i, /won\s+(a\s+)?(\$|£|€)/i, /claim\s+your/i,
      /urgent.*response/i, /act\s+now/i, /limited\s+time/i,
      /nigerian?\s+prince/i, /inheritance/i, /million\s+dollars/i,
      /viagra/i, /cialis/i, /pharmacy/i, /medication/i,
      /enlarge/i, /weight\s+loss/i, /lose\s+\d+\s+pounds/i,
      /crypto.*invest/i, /bitcoin.*opportunity/i, /make\s+money\s+fast/i,
      /work\s+from\s+home.*\$/i, /earn\s+\$\d+/i,
      /congratulations.*selected/i, /you've\s+been\s+selected/i,
      /free\s+gift/i, /click\s+here\s+now/i,
      /account.*suspend/i, /verify.*account.*immediate/i,
      /password.*expire/i, /unusual.*activity/i
    ],
    senders: [
      /@.*\.ru$/i, /@.*\.cn$/i, /@.*\.tk$/i, /@.*\.xyz$/i,
      /noreply.*random/i, /support@(?!google|microsoft|apple|amazon)/i
    ],
    snippets: [
      /dear\s+(sir|madam|friend|customer)/i,
      /kindly\s+(revert|respond|click)/i,
      /do\s+the\s+needful/i,
      /western\s+union/i, /money\s+gram/i,
      /wire\s+transfer/i, /bank\s+account.*details/i,
      /social\s+security.*number/i, /ssn/i,
      /unsubscribe.*click/i
    ]
  };

  // Gmail category labels that should be treated as spam
  const SPAM_CATEGORIES = [
    'CATEGORY_PROMOTIONS',
    'CATEGORY_SOCIAL',
    'CATEGORY_UPDATES'
  ];

  // Check if email is spam
  function isSpamEmail(email) {
    const subject = email.subject || '';
    const from = email.from || '';
    const snippet = email.snippet || '';
    const labelIds = email.labelIds || [];

    // Check Gmail category labels (Promotions, Social, Updates)
    for (const category of SPAM_CATEGORIES) {
      if (labelIds.includes(category)) {
        console.log(`🚫 Spam detected (${category}): "${subject.substring(0, 50)}..."`);
        return true;
      }
    }

    // Check subject patterns
    for (const pattern of SPAM_PATTERNS.subjects) {
      if (pattern.test(subject)) {
        console.log(`🚫 Spam detected (subject): "${subject.substring(0, 50)}..."`);
        return true;
      }
    }

    // Check sender patterns
    for (const pattern of SPAM_PATTERNS.senders) {
      if (pattern.test(from)) {
        console.log(`🚫 Spam detected (sender): "${from}"`);
        return true;
      }
    }

    // Check snippet patterns
    for (const pattern of SPAM_PATTERNS.snippets) {
      if (pattern.test(snippet)) {
        console.log(`🚫 Spam detected (content): "${snippet.substring(0, 50)}..."`);
        return true;
      }
    }

    return false;
  }

  // Move email to spam
  async function moveToSpam(emailId) {
    try {
      await modifyEmailLabels(emailId, ['SPAM'], ['INBOX']);
      console.log(`🚫 Moved email ${emailId} to spam`);
      return true;
    } catch (error) {
      console.error('Error moving to spam:', error);
      return false;
    }
  }

  // Update inbox unread count
  function updateInboxCount(emails) {
    const inboxCountEl = document.getElementById('inboxCount');
    if (inboxCountEl) {
      const unreadCount = emails.filter(e => e.isUnread).length;
      if (unreadCount > 0) {
        inboxCountEl.textContent = unreadCount;
        inboxCountEl.style.display = 'inline-block';
      } else {
        inboxCountEl.style.display = 'none';
      }
    }
  }

  // Load emails from Gmail API
  async function loadEmails(labelId = 'INBOX') {
    console.log(`📧 Loading emails for label: ${labelId}`);
    try {
      if (emailList) {
        emailList.innerHTML = '<div class="email-loading">Loading emails...</div>';
      }

      const url = `http://localhost:3001/api/gmail/messages?labelIds=${labelId}&maxResults=30`;
      console.log(`📧 Fetching: ${url}`);
      const response = await fetch(url);
      const data = await response.json();
      console.log(`📧 Response for ${labelId}:`, data);

      if (!data.success) {
        throw new Error(data.error || 'Failed to load emails');
      }

      let emails = data.messages || [];
      console.log(`📧 Loaded ${emails.length} emails for ${labelId}`);

      // Auto-detect and move spam (only for inbox)
      if (labelId === 'INBOX') {
        const spamEmails = [];
        const cleanEmails = [];

        for (const email of emails) {
          if (isSpamEmail(email)) {
            spamEmails.push(email);
          } else {
            cleanEmails.push(email);
          }
        }

        // Move detected spam to spam folder (silently)
        if (spamEmails.length > 0) {
          console.log(`🚫 Auto-filtering ${spamEmails.length} spam emails...`);
          for (const spam of spamEmails) {
            await moveToSpam(spam.id);
          }
        }

        emails = cleanEmails;

        // Update unread count for inbox
        updateInboxCount(emails);
      }

      currentEmails = emails;
      renderEmailList(currentEmails);

    } catch (error) {
      console.error('Error loading emails:', error);
      if (emailList) {
        emailList.innerHTML = `<div class="email-error">Error loading emails: ${error.message}</div>`;
      }
    }
  }

  // Render email list
  function renderEmailList(emails) {
    if (!emailList) return;

    if (emails.length === 0) {
      emailList.innerHTML = '<div class="no-emails">No emails in this folder</div>';
      return;
    }

    emailList.innerHTML = emails.map(email => {
      const fromName = email.from.split('<')[0].trim().replace(/"/g, '') || email.from;
      const dateStr = formatEmailDate(email.date);
      const unreadClass = email.isUnread ? 'unread' : '';

      return `
        <div class="email-item ${unreadClass}" data-email-id="${email.id}">
          <div class="email-sender">${escapeHtml(fromName)}</div>
          <div class="email-subject">${escapeHtml(email.subject || '(No Subject)')}</div>
          <div class="email-preview">${escapeHtml(email.snippet || '')}</div>
          <div class="email-date">${dateStr}</div>
        </div>
      `;
    }).join('');

    // Add click handlers
    const emailItems = document.querySelectorAll('.email-item');
    console.log(`📧 Adding click handlers to ${emailItems.length} email items`);
    emailItems.forEach(item => {
      item.addEventListener('click', (e) => {
        console.log('📧 Email item clicked:', item.dataset.emailId);
        openEmail(item.dataset.emailId);
      });
    });
  }

  // Format email date
  function formatEmailDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Open email detail in preview panel (not modal)
  async function openEmail(emailId) {
    console.log('📧 openEmail called with ID:', emailId);
    const previewPanel = document.getElementById('emailPreviewPanel');
    console.log('📧 Preview panel found:', !!previewPanel);

    try {
      // Show loading state in preview panel
      if (previewPanel) {
        previewPanel.innerHTML = '<div class="email-preview-placeholder"><span>Loading email...</span></div>';
      }

      const response = await fetch(`http://localhost:3001/api/gmail/messages/${emailId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load email');
      }

      currentEmailData = data;

      // Parse sender info
      const fromName = data.from.split('<')[0].trim().replace(/"/g, '') || data.from;
      const fromEmail = data.from.match(/<(.+)>/)?.[1] || data.from;

      // Mark as read in Gmail (always mark when opened)
      try {
        const markReadResponse = await fetch(`http://localhost:3001/api/gmail/messages/${emailId}/read`, { method: 'POST' });
        const markReadResult = await markReadResponse.json();
        if (markReadResult.success) {
          console.log('✅ Email marked as read in Gmail');
        } else {
          console.warn('Failed to mark email as read:', markReadResult.error);
        }
      } catch (markReadError) {
        console.error('Error marking email as read:', markReadError);
      }
      // Update UI regardless
      const emailItem = document.querySelector(`[data-email-id="${emailId}"]`);
      if (emailItem) emailItem.classList.remove('unread');

      // Highlight selected email in list
      document.querySelectorAll('.email-item').forEach(item => item.classList.remove('selected'));
      const selectedItem = document.querySelector(`[data-email-id="${emailId}"]`);
      if (selectedItem) selectedItem.classList.add('selected');

      // Display email in the preview panel (right side)
      if (previewPanel) {
        // Sanitize and prepare email body for iframe
        const emailBody = data.body || '<p>No content</p>';

        previewPanel.innerHTML = `
          <div class="email-preview-content">
            <div class="email-preview-header">
              <div class="email-preview-sender">
                <span class="sender-avatar-preview">${fromName.charAt(0).toUpperCase()}</span>
                <div class="sender-info">
                  <div class="sender-name">${escapeHtml(fromName)}</div>
                  <div class="sender-email">${escapeHtml(fromEmail)}</div>
                </div>
              </div>
              <div class="email-preview-date">${new Date(data.date).toLocaleString()}</div>
            </div>
            <div class="email-preview-subject">${escapeHtml(data.subject || '(No Subject)')}</div>
            <div class="email-preview-actions">
              <button class="preview-action-btn" id="previewReplyBtn">↩️ Reply</button>
              <button class="preview-action-btn" id="previewForwardBtn">➡️ Forward</button>
              <button class="preview-action-btn ai-reply-btn" id="previewAIReplyBtn">🤖 AI Reply</button>
              <button class="preview-action-btn" id="previewLabelBtn">🏷️ Label</button>
              <button class="preview-action-btn danger" id="previewDeleteBtn">🗑️ Delete</button>
            </div>
            <div class="email-preview-body-container">
              <iframe id="emailBodyFrame" class="email-body-iframe" sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"></iframe>
            </div>
          </div>
        `;

        // Write email content to iframe for proper HTML rendering
        const iframe = document.getElementById('emailBodyFrame');
        if (iframe) {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          iframeDoc.open();
          iframeDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                * {
                  color: #ffffff !important;
                }
                body {
                  font-family: 'Segoe UI', Arial, sans-serif;
                  font-size: 14px;
                  line-height: 1.6;
                  color: #ffffff !important;
                  background: #1a1a2e !important;
                  margin: 0;
                  padding: 10px;
                  word-wrap: break-word;
                  overflow-wrap: break-word;
                }
                /* Override any inline dark text colors */
                p, div, span, td, th, li, h1, h2, h3, h4, h5, h6, font {
                  color: #ffffff !important;
                }
                a { color: #00ff41 !important; cursor: pointer; text-decoration: underline; }
                a:hover { color: #00ff90 !important; }
                /* Image handling - show placeholder for broken images */
                img {
                  max-width: 100%;
                  height: auto;
                  background: rgba(255,255,255,0.1);
                  min-height: 20px;
                }
                img[src=""], img:not([src]) {
                  display: none;
                }
                pre, code {
                  background: rgba(0,0,0,0.3);
                  padding: 2px 6px;
                  border-radius: 3px;
                  font-family: 'Consolas', monospace;
                  font-size: 13px;
                  white-space: pre-wrap;
                  word-wrap: break-word;
                  overflow-x: auto;
                  max-width: 100%;
                  color: #00ff41 !important;
                }
                blockquote {
                  border-left: 3px solid #00ff41;
                  margin: 10px 0;
                  padding-left: 15px;
                  color: #cccccc !important;
                }
                table { border-collapse: collapse; max-width: 100%; background: transparent !important; }
                td, th { border: 1px solid #444; padding: 5px; background: transparent !important; }
                /* Hide tracking pixels and tiny images */
                img[width="1"], img[height="1"], img[style*="display:none"], img[style*="display: none"] {
                  display: none !important;
                }
              </style>
            </head>
            <body>${emailBody}</body>
            <scr` + `ipt>
              // Intercept link clicks and open in external browser
              document.addEventListener('click', function(e) {
                var link = e.target.closest('a');
                if (link && link.href) {
                  e.preventDefault();
                  // Send message to parent to open link externally
                  window.parent.postMessage({ type: 'openExternalLink', url: link.href }, '*');
                }
              });
              // Handle broken images - hide them
              document.querySelectorAll('img').forEach(function(img) {
                img.onerror = function() {
                  this.style.display = 'none';
                };
              });
            </scr` + `ipt>
            </html>
          `);
          iframeDoc.close();

          // Auto-resize iframe to fit content
          iframe.onload = function() {
            try {
              const height = iframe.contentDocument.body.scrollHeight;
              iframe.style.height = Math.min(height + 20, 500) + 'px';
            } catch (e) {
              iframe.style.height = '300px';
            }
          };
          // Trigger resize
          setTimeout(() => {
            try {
              const height = iframeDoc.body.scrollHeight;
              iframe.style.height = Math.min(height + 20, 500) + 'px';
            } catch (e) {
              iframe.style.height = '300px';
            }
          }, 100);
        }

        // Add action handlers for preview buttons
        document.getElementById('previewReplyBtn')?.addEventListener('click', () => {
          if (composeEmailModal) composeEmailModal.classList.add('active');
          document.getElementById('emailTo').value = fromEmail;
          document.getElementById('emailSubject').value = 'Re: ' + (data.subject || '');
          document.getElementById('emailBody').value = '';
        });

        document.getElementById('previewForwardBtn')?.addEventListener('click', () => {
          if (composeEmailModal) composeEmailModal.classList.add('active');
          document.getElementById('emailTo').value = '';
          document.getElementById('emailSubject').value = 'Fwd: ' + (data.subject || '');
          document.getElementById('emailBody').value = '\n\n---------- Forwarded message ----------\n' + (data.body || '');
        });

        document.getElementById('previewAIReplyBtn')?.addEventListener('click', () => {
          // Switch to dashboard view and open Admiral chat
          document.querySelector('[data-view="dashboard"]').click();

          // Get full email body from iframe
          let fullEmailBody = data.snippet || '';
          const iframe = document.getElementById('emailBodyFrame');
          if (iframe) {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              fullEmailBody = iframeDoc.body?.innerText || data.snippet || '';
            } catch (e) {
              fullEmailBody = data.snippet || '';
            }
          }

          // Focus chat input and pre-fill with prompt template (DO NOT SEND)
          setTimeout(() => {
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
              const emailContext = `Reply to this email

Direction/Context: [ENTER YOUR DIRECTION HERE - e.g., "politely decline", "ask for more details", "confirm the meeting"]

------- ORIGINAL EMAIL -------
From: ${fromName}
Subject: ${data.subject || '(No Subject)'}
Date: ${new Date(data.date).toLocaleString()}

${fullEmailBody}
------- END EMAIL -------`;

              chatInput.value = emailContext;
              chatInput.focus();
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

        document.getElementById('previewLabelBtn')?.addEventListener('click', () => {
          showLabelPicker(emailId);
        });

        document.getElementById('previewDeleteBtn')?.addEventListener('click', async () => {
          if (confirm('Delete this email?')) {
            try {
              await modifyEmailLabels(emailId, ['TRASH'], ['INBOX']);
              console.log('Moved email to trash:', emailId);
              previewPanel.innerHTML = '<div class="email-preview-placeholder"><span>Select an email to preview</span></div>';
              loadEmails(currentFolder);
            } catch (error) {
              alert('Error deleting email: ' + error.message);
            }
          }
        });
      }

    } catch (error) {
      console.error('Error opening email:', error);
      if (previewPanel) {
        previewPanel.innerHTML = `<div class="email-preview-placeholder"><span>Error loading email: ${escapeHtml(error.message)}</span></div>`;
      }
    }
  }

  // Gmail Login - Open Google OAuth (direct assignment like calendar import)
  const emailGmailLoginBtnElement = document.getElementById('emailGmailLoginBtn');
  if (emailGmailLoginBtnElement) {
    emailGmailLoginBtnElement.addEventListener('click', () => {
      console.log('Gmail login button clicked!');
      const authUrl = 'http://localhost:3001/auth';

      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(authUrl);
      } else {
        window.open(authUrl, '_blank');
      }

      // Poll for auth completion after user is redirected to OAuth
      let pollCount = 0;
      const maxPolls = 60; // Check for 2 minutes max
      const pollInterval = setInterval(async () => {
        pollCount++;
        if (pollCount > maxPolls) {
          clearInterval(pollInterval);
          return;
        }

        const isAuthed = await checkGmailAuth();
        if (isAuthed) {
          clearInterval(pollInterval);
          console.log('✅ Gmail authentication detected, loading emails...');
        }
      }, 2000); // Check every 2 seconds
    });
    console.log('✅ Gmail login button handler attached');
  } else {
    console.error('❌ Could not find emailGmailLoginBtn element');
  }

  // Email Refresh
  if (emailRefreshBtn) {
    emailRefreshBtn.addEventListener('click', async () => {
      console.log('Refreshing emails...');
      const isAuthed = await checkGmailAuth();
      if (isAuthed) {
        loadEmails(currentFolder);
      }
    });
  }

  // Email Compose
  if (emailComposeBtn) {
    emailComposeBtn.addEventListener('click', () => {
      if (composeEmailModal) composeEmailModal.classList.add('active');
      document.getElementById('emailTo').value = '';
      document.getElementById('emailSubject').value = '';
      document.getElementById('emailBody').value = '';
    });
  }

  // Gmail label ID mapping - maps UI folder names to Gmail API label IDs
  const folderToLabelMap = {
    'inbox': 'INBOX',
    'starred': 'STARRED',
    'sent': 'SENT',
    'drafts': 'DRAFT',
    'spam': 'SPAM',
    'trash': 'TRASH'
  };

  // Email Folder Navigation
  emailFolders.forEach(folder => {
    folder.addEventListener('click', () => {
      emailFolders.forEach(f => f.classList.remove('active'));
      folder.classList.add('active');
      const folderName = folder.dataset.folder;
      const labelId = folderToLabelMap[folderName] || 'INBOX';
      currentFolder = labelId;
      console.log('Switching to folder:', folderName, '-> Gmail label:', labelId);
      loadEmails(labelId);
    });
  });

  if (closeEmailDetailModal) {
    closeEmailDetailModal.addEventListener('click', () => {
      if (emailDetailModal) emailDetailModal.classList.remove('active');
    });
  }

  // Email actions
  document.getElementById('replyEmailBtn')?.addEventListener('click', () => {
    if (emailDetailModal) emailDetailModal.classList.remove('active');
    if (emailComposeBtn) emailComposeBtn.click();
    if (currentEmailData) {
      document.getElementById('emailTo').value = currentEmailData.from.match(/<(.+)>/)?.[1] || currentEmailData.from;
      document.getElementById('emailSubject').value = 'Re: ' + (currentEmailData.subject || '');
    }
  });

  document.getElementById('forwardEmailBtn')?.addEventListener('click', () => {
    if (emailDetailModal) emailDetailModal.classList.remove('active');
    if (emailComposeBtn) emailComposeBtn.click();
    if (currentEmailData) {
      document.getElementById('emailSubject').value = 'Fwd: ' + (currentEmailData.subject || '');
      document.getElementById('emailBody').value = '\n\n---------- Forwarded message ----------\n' + (currentEmailData.body || '');
    }
  });

  document.getElementById('deleteEmailBtn')?.addEventListener('click', () => {
    if (confirm('Delete this email?')) {
      console.log('Deleting email...');
      if (emailDetailModal) emailDetailModal.classList.remove('active');
      alert('Email deleted!');
    }
  });

  // Close modals on outside click
  [composeEmailModal, emailDetailModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    }
  });

  // Check auth on page load
  setTimeout(() => checkGmailAuth(), 1000);

  // Expose functions that may be needed by other modules
  window.EmailModule = {
    checkGmailAuth,
    loadEmails,
    loadGmailLabels
  };

  console.log('✅ Email module loaded');
})();
