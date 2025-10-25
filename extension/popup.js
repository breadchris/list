// Share Extension - Popup Script

document.addEventListener('DOMContentLoaded', initialize);

let currentStats = {
  shareCount: 0,
  lastShared: null,
  currentUrl: null,
  isShareable: false
};

let authStatus = {
  authenticated: false,
  userId: null
};

let selectedGroupId = null;
let groups = [];

async function initialize() {
  console.log('Share popup initializing...');

  try {
    // Check authentication first
    await checkAuth();

    // Load groups if authenticated
    if (authStatus.authenticated) {
      await loadGroups();
      await loadSelectedGroup();
    }

    // Load initial stats and page info
    await loadStats();
    await updateUI();

    // Set up event listeners
    document.getElementById('share-btn').addEventListener('click', sharePage);
    document.getElementById('reload-btn').addEventListener('click', reloadExtension);
    document.getElementById('group-select').addEventListener('change', handleGroupChange);
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('settings-toggle').addEventListener('click', toggleSettings);
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);

    // Load web app URL setting
    await loadWebAppUrl();

    // Update keyboard shortcuts for different platforms
    updateKeyboardShortcuts();

  } catch (error) {
    console.error('Error initializing popup:', error);
    showError('Failed to initialize extension popup');
  }
}

async function checkAuth() {
  console.log('[POPUP] Starting auth check...');
  try {
    console.log('[POPUP] Sending check-auth message...');
    const response = await chrome.runtime.sendMessage({ action: 'check-auth' });
    console.log('[POPUP] Received response:', response);

    if (response && response.success) {
      console.log('[POPUP] Response has success, authenticated:', response.authenticated);
      authStatus.authenticated = response.authenticated;
      authStatus.userId = response.userId;

      // Update auth status UI
      const authStatusEl = document.getElementById('auth-status');
      const authTextEl = document.getElementById('auth-text');
      const loginBtn = document.getElementById('login-btn');

      if (!authStatus.authenticated) {
        console.log('[POPUP] Setting UI to not-authenticated');
        authStatusEl.className = 'auth-status not-authenticated';
        authTextEl.textContent = '⚠️ Not logged in';
        loginBtn.style.display = 'block';
      } else {
        console.log('[POPUP] Setting UI to authenticated');
        authStatusEl.className = 'auth-status authenticated';
        authTextEl.textContent = '✓ Logged in';
        loginBtn.style.display = 'none';
      }

      console.log('[POPUP] Auth status:', authStatus);
    } else {
      console.log('[POPUP] Response failed check:', { hasResponse: !!response, success: response?.success });
    }
  } catch (error) {
    console.error('[POPUP] Error checking auth:', error);
    authStatus.authenticated = false;

    // Show error state
    const authStatusEl = document.getElementById('auth-status');
    const authTextEl = document.getElementById('auth-text');
    const loginBtn = document.getElementById('login-btn');

    authStatusEl.className = 'auth-status not-authenticated';
    authTextEl.textContent = '⚠️ Authentication error';
    loginBtn.style.display = 'block';
  }
}

async function loadGroups() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'get-groups' });

    if (response && response.success) {
      groups = response.groups || [];
      console.log('Loaded groups:', groups);

      // Update group select dropdown
      const groupSelect = document.getElementById('group-select');
      groupSelect.innerHTML = '';

      if (groups.length === 0) {
        groupSelect.innerHTML = '<option value="">No groups available</option>';
      } else {
        groupSelect.innerHTML = '<option value="">Select a group...</option>';
        groups.forEach(group => {
          const option = document.createElement('option');
          option.value = group.id;
          option.textContent = group.name;
          groupSelect.appendChild(option);
        });
      }
    }
  } catch (error) {
    console.error('Error loading groups:', error);
  }
}

async function loadSelectedGroup() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'get-selected-group' });

    if (response && response.success && response.groupId) {
      selectedGroupId = response.groupId;
      console.log('Selected group:', selectedGroupId);

      // Set the dropdown value
      const groupSelect = document.getElementById('group-select');
      groupSelect.value = selectedGroupId;

      // Update status
      updateGroupStatus();
    }
  } catch (error) {
    console.error('Error loading selected group:', error);
  }
}

async function handleGroupChange(event) {
  const groupId = event.target.value;

  if (!groupId) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({ action: 'select-group', groupId });

    if (response && response.success) {
      selectedGroupId = groupId;
      console.log('Group selection saved:', groupId);
      showSuccess('Group selection saved!');
      updateGroupStatus();
    }
  } catch (error) {
    console.error('Error saving group selection:', error);
    showError('Failed to save group selection');
  }
}

function updateGroupStatus() {
  const groupStatus = document.getElementById('group-status');
  if (selectedGroupId) {
    const selectedGroup = groups.find(g => g.id === selectedGroupId);
    if (selectedGroup) {
      groupStatus.textContent = `✓ Sharing to "${selectedGroup.name}"`;
      groupStatus.style.color = '#28a745';
    }
  } else {
    groupStatus.textContent = '⚠️ Please select a group';
    groupStatus.style.color = '#666';
  }
}

async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'get-stats' });
    
    if (response && !response.error) {
      currentStats = response;
      console.log('Loaded stats:', currentStats);
    } else {
      console.error('Error loading stats:', response?.error);
    }
  } catch (error) {
    console.error('Error communicating with background script:', error);
  }
}

async function updateUI() {
  try {
    // Update current page info
    const pageTitle = document.getElementById('page-title');
    const pageUrl = document.getElementById('page-url');
    const shareBtn = document.getElementById('share-btn');
    
    if (currentStats.currentUrl) {
      // Truncate title if too long
      const title = currentStats.currentUrl.length > 0 ? 
        document.title || 'Current Page' : 'No Page';
      pageTitle.textContent = title.length > 60 ? title.substring(0, 60) + '...' : title;
      
      // Truncate URL if too long
      let displayUrl = currentStats.currentUrl;
      if (displayUrl.length > 50) {
        displayUrl = displayUrl.substring(0, 47) + '...';
      }
      pageUrl.textContent = displayUrl;
      
      // Enable/disable share button based on URL
      shareBtn.disabled = !currentStats.isShareable;
      if (!currentStats.isShareable) {
        shareBtn.title = 'This type of page cannot be shared';
      } else {
        shareBtn.title = 'Share this page (Cmd+Shift+B)';
      }
    } else {
      pageTitle.textContent = 'No active page';
      pageUrl.textContent = 'Unable to access current page';
      shareBtn.disabled = true;
    }
    
    // Update stats
    document.getElementById('share-count').textContent = currentStats.shareCount;
    
    // Format last share time
    const lastShareEl = document.getElementById('last-share');
    if (currentStats.lastShared) {
      const lastTime = new Date(currentStats.lastShared);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastTime) / (1000 * 60));
      
      if (diffMinutes < 1) {
        lastShareEl.textContent = 'Just now';
      } else if (diffMinutes < 60) {
        lastShareEl.textContent = `${diffMinutes}m ago`;
      } else if (diffMinutes < 1440) {
        lastShareEl.textContent = `${Math.floor(diffMinutes / 60)}h ago`;
      } else {
        lastShareEl.textContent = `${Math.floor(diffMinutes / 1440)}d ago`;
      }
    } else {
      lastShareEl.textContent = 'Never';
    }
    
  } catch (error) {
    console.error('Error updating UI:', error);
  }
}

async function sharePage() {
  const button = document.getElementById('share-btn');
  const originalText = button.innerHTML;
  
  try {
    // Disable button and show loading
    button.disabled = true;
    button.innerHTML = '<span class="button-icon">⏳</span><span>Sharing...</span>';
    showLoading(true);
    
    // Send share request to background script
    const response = await chrome.runtime.sendMessage({ action: 'share-page' });
    
    if (response && response.success) {
      showSuccess('Page shared successfully!');
      
      // Update stats
      currentStats.shareCount += 1;
      currentStats.lastShared = Date.now();
      await updateUI();
      
      // Briefly show success state on button
      button.innerHTML = '<span class="button-icon">✅</span><span>Shared!</span>';
      setTimeout(() => {
        button.innerHTML = originalText;
        button.disabled = false;
      }, 1500);
      
    } else {
      throw new Error(response?.error || 'Unknown error occurred');
    }
    
  } catch (error) {
    console.error('Error sharing page:', error);
    showError('Failed to share page: ' + error.message);
    
    // Restore button
    button.innerHTML = originalText;
    button.disabled = currentStats.isShareable ? false : true;
  } finally {
    showLoading(false);
  }
}

async function reloadExtension() {
  const button = document.getElementById('reload-btn');
  const originalText = button.innerHTML;
  
  try {
    // Disable button and show loading
    button.disabled = true;
    button.innerHTML = '<span class="button-icon">⏳</span><span>Reloading...</span>';
    showLoading(true);
    
    showSuccess('Extension is reloading...');
    
    // Send reload request to background script
    await chrome.runtime.sendMessage({ action: 'reload-extension' });
    
    // If we get here, the reload didn't work as expected
    setTimeout(() => {
      button.innerHTML = originalText;
      button.disabled = false;
      showLoading(false);
    }, 2000);
    
  } catch (error) {
    console.error('Error reloading extension:', error);
    showError('Failed to reload extension: ' + error.message);
    
    // Restore button
    button.innerHTML = originalText;
    button.disabled = false;
    showLoading(false);
  }
}

function showSuccess(message) {
  const successEl = document.getElementById('success-message');
  const errorEl = document.getElementById('error-message');
  
  // Hide error message
  errorEl.classList.remove('show');
  
  // Show success message
  successEl.textContent = message;
  successEl.classList.add('show');
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    successEl.classList.remove('show');
  }, 3000);
}

function showError(message) {
  const errorEl = document.getElementById('error-message');
  const successEl = document.getElementById('success-message');
  
  // Hide success message
  successEl.classList.remove('show');
  
  // Show error message
  errorEl.textContent = message;
  errorEl.classList.add('show');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorEl.classList.remove('show');
  }, 5000);
}

function showLoading(show) {
  const loadingEl = document.getElementById('loading');
  if (show) {
    loadingEl.classList.add('show');
  } else {
    loadingEl.classList.remove('show');
  }
}

function updateKeyboardShortcuts() {
  // Update keyboard shortcuts display for different platforms
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const shortcuts = document.querySelectorAll('.keyboard-shortcut');
  shortcuts.forEach(shortcut => {
    if (isMac) {
      // Already shows Cmd+Shift+B and Cmd+Shift+R for Mac
    } else {
      // Update to show Ctrl+Shift+B and Ctrl+Shift+R for Windows/Linux
      shortcut.textContent = shortcut.textContent.replace('Cmd+', 'Ctrl+');
    }
  });
}

async function handleLogin() {
  const button = document.getElementById('login-btn');
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = 'Opening...';

    // Send login request to background script (opens web app in new tab)
    const response = await chrome.runtime.sendMessage({ action: 'login' });

    if (response && response.success) {
      showSuccess('Login page opened. Please sign in and close the tab when done.');

      // Check auth status after a delay
      setTimeout(async () => {
        await checkAuth();
        if (authStatus.authenticated) {
          await loadGroups();
          await loadSelectedGroup();
          showSuccess('Successfully logged in!');
        }
      }, 3000);
    } else {
      throw new Error(response?.error || 'Failed to open login page');
    }
  } catch (error) {
    console.error('Error opening login:', error);
    showError('Failed to open login page: ' + error.message);
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

function toggleSettings() {
  const settingsPanel = document.getElementById('settings-panel');
  settingsPanel.classList.toggle('show');
}

async function loadWebAppUrl() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'get-web-app-url' });

    if (response && response.success) {
      const urlInput = document.getElementById('web-app-url-input');
      urlInput.value = response.url;
      console.log('Loaded web app URL:', response.url);
    }
  } catch (error) {
    console.error('Error loading web app URL:', error);
  }
}

async function saveSettings() {
  const button = document.getElementById('save-settings-btn');
  const urlInput = document.getElementById('web-app-url-input');
  const originalText = button.textContent;

  try {
    const url = urlInput.value.trim();

    if (!url) {
      showError('Please enter a web app URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      showError('Please enter a valid URL');
      return;
    }

    button.disabled = true;
    button.textContent = 'Saving...';

    const response = await chrome.runtime.sendMessage({
      action: 'set-web-app-url',
      url: url
    });

    if (response && response.success) {
      showSuccess('Settings saved successfully!');
      console.log('Web app URL updated to:', url);
    } else {
      throw new Error(response?.error || 'Failed to save settings');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showError('Failed to save settings: ' + error.message);
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

// Handle messages from background script (if any)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Popup received message:', message);
  
  switch (message.type) {
    case 'stats-updated':
      currentStats = message.stats;
      updateUI();
      break;
      
    case 'share-success':
      showSuccess(`"${message.title}" shared successfully!`);
      // Refresh stats display
      loadStats().then(() => updateUI());
      break;
      
    case 'share-error':
      showError('Failed to share page');
      break;
  }
});

console.log('Share extension popup script loaded');