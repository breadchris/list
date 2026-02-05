// Share Extension - Background Script
// Handles sharing and extension reload functionality

import { createClient } from "@supabase/supabase-js";

console.log("Share extension loaded");

// Supabase configuration
const SUPABASE_URL = "https://zazsrepfnamdmibcyenx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphenNyZXBmbmFtZG1pYmN5ZW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTYyNzMsImV4cCI6MjA3MDg3MjI3M30.IG4pzHdSxcbxCtonJ2EiczUDFeR5Lh41CI9MU2YrciM";

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
    storage: {
      getItem: async (key) => {
        const result = await chrome.storage.local.get([key]);
        const value = result[key] ?? null;
        console.log(
          `[STORAGE] getItem("${key}"):`,
          value
            ? `found (${typeof value}, ${value.length || 0} bytes)`
            : "null",
        );
        return value;
      },
      setItem: async (key, value) => {
        console.log(
          `[STORAGE] setItem("${key}"):`,
          typeof value,
          value ? `${value.length || 0} bytes` : "null",
        );
        return chrome.storage.local.set({ [key]: value });
      },
      removeItem: async (key) => {
        console.log(`[STORAGE] removeItem("${key}")`);
        return chrome.storage.local.remove([key]);
      },
    },
  },
});

// Backend server configuration (for backwards compatibility)
const DEFAULT_SERVER_URL = "http://localhost:8080";
let serverUrl = DEFAULT_SERVER_URL;

// Web app URL configuration for authentication
const DEFAULT_WEB_APP_URL = "http://localhost:3000";
let webAppUrl = DEFAULT_WEB_APP_URL;

// Group and authentication management
interface Group {
  id: string;
  name: string;
  created_at: string;
}

// Get saved group ID from storage
async function getSelectedGroupId(): Promise<string | null> {
  try {
    const result = await chrome.storage.sync.get(["selectedGroupId"]);
    return result.selectedGroupId || null;
  } catch (error) {
    console.error("Error loading selected group:", error);
    return null;
  }
}

// Save selected group ID to storage
async function saveSelectedGroupId(groupId: string): Promise<void> {
  try {
    await chrome.storage.sync.set({ selectedGroupId: groupId });
    console.log("Saved selected group:", groupId);
  } catch (error) {
    console.error("Error saving selected group:", error);
  }
}

// Fetch user's groups from Supabase
async function fetchUserGroups(): Promise<Group[]> {
  console.log("[GROUPS] Fetching user groups...");

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log("[GROUPS] getUser result:", {
      hasUser: !!user,
      userId: user?.id,
    });

    if (!user) {
      console.warn("[GROUPS] No authenticated user");
      return [];
    }

    const { data, error } = await supabase
      .from("group_memberships")
      .select(
        `
        group_id,
        groups (
          id,
          name,
          created_at
        )
      `,
      )
      .eq("user_id", user.id);

    if (error) {
      console.error("[GROUPS] Error fetching groups:", error);
      return [];
    }

    const groups = data?.map((item: any) => item.groups).filter(Boolean) || [];
    console.log("[GROUPS] Found groups:", groups.length);
    return groups;
  } catch (error) {
    console.error("[GROUPS] Exception in fetchUserGroups:", error);
    return [];
  }
}

// Redirect to login page
async function redirectToLogin() {
  console.log("Redirecting to login:", webAppUrl);

  // Open login page in new tab
  await chrome.tabs.create({
    url: `${webAppUrl}/`, // React app shows auth UI when not logged in
    active: true,
  });

  showNotification("Login Required", "Please sign in to use the extension");
}

// Check authentication status
async function checkAuthStatus(
  redirectOnFail: boolean = false,
): Promise<{ authenticated: boolean; userId?: string }> {
  console.log(
    "[AUTH CHECK] Starting auth check, redirectOnFail:",
    redirectOnFail,
  );

  try {
    console.log("[AUTH CHECK] Calling supabase.auth.getUser()...");
    const { data, error } = await supabase.auth.getUser();

    console.log("[AUTH CHECK] getUser response:", {
      hasUser: !!data.user,
      userId: data.user?.id,
      userEmail: data.user?.email,
      hasError: !!error,
      errorCode: error?.code,
      errorMessage: error?.message,
    });

    // Check if user exists
    const authenticated = !!data.user && !error;
    console.log("[AUTH CHECK] Computed authenticated:", authenticated);

    if (!authenticated && redirectOnFail) {
      console.log("[AUTH CHECK] Not authenticated, redirecting to login");
      await redirectToLogin();
    }

    const result = {
      authenticated,
      userId: data.user?.id,
    };
    console.log("[AUTH CHECK] Returning:", result);
    return result;
  } catch (error) {
    console.error("[AUTH CHECK] Exception in checkAuthStatus:", error);

    if (redirectOnFail) {
      console.log("[AUTH CHECK] Exception occurred, redirecting to login");
      await redirectToLogin();
    }

    return { authenticated: false };
  }
}

// Load server URL from storage
async function loadServerUrl() {
  try {
    const result = await chrome.storage.sync.get(["serverUrl"]);
    serverUrl = result.serverUrl || DEFAULT_SERVER_URL;
    console.log("Loaded server URL:", serverUrl);
  } catch (error) {
    console.error("Error loading server URL:", error);
    serverUrl = DEFAULT_SERVER_URL;
  }
}

// Load web app URL from storage
async function loadWebAppUrl() {
  try {
    const result = await chrome.storage.sync.get(["webAppUrl"]);
    webAppUrl = result.webAppUrl || DEFAULT_WEB_APP_URL;
    console.log("Loaded web app URL:", webAppUrl);
  } catch (error) {
    console.error("Error loading web app URL:", error);
    webAppUrl = DEFAULT_WEB_APP_URL;
  }
}

// Initialize server and web app URLs
loadServerUrl();
loadWebAppUrl();

// Extension installation/startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("Extension installed/updated:", details.reason);

  // Load web app URL
  await loadWebAppUrl();

  // Check authentication
  const { authenticated } = await checkAuthStatus(false);

  if (!authenticated) {
    console.log("Not authenticated - user will need to login before sharing");
    showNotification("Welcome!", "Please login to start sharing pages");
  }

  if (details.reason === "install") {
    // Set default server URL if not already set
    chrome.storage.sync.get(["serverUrl"], (result) => {
      if (!result.serverUrl) {
        chrome.storage.sync.set({ serverUrl: DEFAULT_SERVER_URL });
      }
    });

    // Set default web app URL if not already set
    chrome.storage.sync.get(["webAppUrl"], (result) => {
      if (!result.webAppUrl) {
        chrome.storage.sync.set({ webAppUrl: DEFAULT_WEB_APP_URL });
      }
    });
  }

  // Always create context menus on any install/update/reload
  createContextMenus();
  updateExtensionBadge();
});

// Also create context menus on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log("Extension startup");
  await loadWebAppUrl();
  await checkAuthStatus(false); // Check but don't redirect on startup
  createContextMenus();
  updateExtensionBadge();
});

// Create context menus
function createContextMenus() {
  // Remove existing menus first
  chrome.contextMenus.removeAll(() => {
    // Create share page context menu
    chrome.contextMenus.create({
      id: "sharePage",
      title: "Share this page",
      contexts: ["page"],
    });

    // Create reload extension context menu
    chrome.contextMenus.create({
      id: "reloadExtension",
      title: "Reload Extension",
      contexts: ["all"],
    });

    console.log("Context menus created");
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("Context menu clicked:", info.menuItemId);

  switch (info.menuItemId) {
    case "sharePage":
      shareCurrentPage();
      break;
    case "reloadExtension":
      reloadExtension();
      break;
  }
});

// Content script keyboard shortcuts now handled by existing message listener below

// Share current page function
async function shareCurrentPage() {
  try {
    // Check authentication with redirect enabled
    const authStatus = await checkAuthStatus(true); // Will redirect if not authenticated

    if (!authStatus.authenticated) {
      // redirectToLogin() already called by checkAuthStatus
      return; // Stop execution
    }

    // Get selected group ID
    let groupId = await getSelectedGroupId();

    // If no group selected, notify popup to show group selector
    if (!groupId) {
      showNotification(
        "No Group Selected",
        "Please select a group in the extension popup",
      );
      throw new Error("No group selected");
    }

    // Get current active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab) {
      console.error("No active tab found");
      return;
    }

    // Check if URL is shareable (skip chrome:// URLs etc.)
    if (!isShareableUrl(tab.url)) {
      console.warn("Cannot share this type of URL:", tab.url);
      showNotification(
        "Cannot share this page",
        "This type of URL cannot be shared",
      );
      return;
    }

    // Get page HTML content from content script
    let pageHTML = "";
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "get-page-html",
      });
      pageHTML = response?.html || "";
    } catch (error) {
      console.warn("Could not extract HTML from page:", error);
      // Continue without HTML - we can still save the URL
    }

    // Check if this is a ChatGPT page and get conversation data
    let contentType = "text";
    let metadata: Record<string, any> = {
      scraped_html: pageHTML,
      scraped_at: new Date().toISOString(),
      page_title: tab.title || "Untitled",
      original_url: tab.url,
    };

    if (isChatGPTUrl(tab.url)) {
      const conversationId = extractChatGPTUUID(tab.url);
      console.log("[ChatGPT] Detected ChatGPT URL, conversation ID:", conversationId);

      if (conversationId) {
        const conversationData = await getChatGPTConversation(conversationId);
        if (conversationData) {
          contentType = "chatgpt";
          metadata = {
            ...metadata,
            conversation: conversationData.conversation,
            conversation_id: conversationId,
            conversation_captured_at: conversationData.captured_at,
          };
          console.log("[ChatGPT] Found stored conversation data for:", conversationId);
        } else {
          console.warn("[ChatGPT] No stored conversation found for:", conversationId);
        }
      }
    }

    // Save to Supabase
    const { data, error } = await supabase
      .from("content")
      .insert({
        type: contentType,
        data: tab.url,
        group_id: groupId,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving to Supabase:", error);
      throw new Error(`Failed to save: ${error.message}`);
    }

    // Note: content_relationship is automatically created by database trigger
    // No need to manually create it here

    console.log("Page shared successfully to Supabase:", data);

    showNotification(
      "Page Shared",
      `"${tab.title}" has been saved to your group`,
    );

    // Update stats and badge (don't await badge to prevent blocking)
    await updateShareStats();
    updateExtensionBadge(); // Fire and forget - don't let badge errors break sharing

    // Notify popup if it's open (handle promise properly)
    try {
      await chrome.runtime.sendMessage({
        type: "share-success",
        title: tab.title,
        url: tab.url,
        contentId: data.id,
      });
      console.log("Successfully notified popup of share success");
    } catch (error) {
      // Popup might not be open, ignore error silently
      console.log(
        "Popup not available for notification (normal when popup is closed)",
      );
    }
  } catch (error: any) {
    console.error("Error sharing page:", error);
    showNotification("Share Failed", `Could not save page: ${error.message}`);
    throw error; // Re-throw for proper error handling in message listeners
  }
}

// Reload extension function
async function reloadExtension() {
  try {
    console.log("Reloading extension...");
    showNotification(
      "Extension Reloading",
      "Restarting the Share extension...",
    );

    // Small delay to show notification
    setTimeout(() => {
      chrome.runtime.reload();
    }, 500);
  } catch (error) {
    console.error("Error reloading extension:", error);
    showNotification("Reload Failed", "Could not reload extension");
  }
}

// Backend health check
async function checkBackendHealth() {
  try {
    const response = await fetch(`${serverUrl}/extension/`, {
      method: "GET",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (response.ok) {
      console.log("Backend is available at:", serverUrl);
      return true;
    } else {
      console.warn("Backend responded with status:", response.status);
      return false;
    }
  } catch (error) {
    console.error("Backend health check failed:", error);
    return false;
  }
}

// Check if URL can be shared
function isShareableUrl(url) {
  if (!url) return false;

  const unshareableProtocols = [
    "chrome://",
    "chrome-extension://",
    "moz-extension://",
    "about:",
    "edge://",
    "opera://",
  ];

  return !unshareableProtocols.some((protocol) => url.startsWith(protocol));
}

// ============================================================================
// ChatGPT Conversation Capture
// ============================================================================

// UUID regex pattern
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Check if URL is a ChatGPT conversation page
function isChatGPTUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "chatgpt.com" && parsed.pathname.includes("/c/");
  } catch {
    return false;
  }
}

// Extract conversation UUID from ChatGPT URL
// Handles: /c/{uuid} or /g/g-p-{gpt-id}/c/{uuid}
function extractChatGPTUUID(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/");

    // Find the UUID after "/c/"
    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i] === "c" && pathParts[i + 1]) {
        const potentialUUID = pathParts[i + 1];
        if (UUID_PATTERN.test(potentialUUID)) {
          return potentialUUID.toLowerCase();
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Store ChatGPT conversation in chrome.storage.local
async function storeChatGPTConversation(
  conversationId: string,
  conversation: any,
  capturedAt: string
): Promise<void> {
  const key = `chatgpt:${conversationId.toLowerCase()}`;
  await chrome.storage.local.set({
    [key]: {
      conversation,
      captured_at: capturedAt,
    },
  });
  console.log("[ChatGPT] Stored conversation:", conversationId);
}

// Retrieve ChatGPT conversation from chrome.storage.local
async function getChatGPTConversation(
  conversationId: string
): Promise<{ conversation: any; captured_at: string } | null> {
  const key = `chatgpt:${conversationId.toLowerCase()}`;
  const result = await chrome.storage.local.get([key]);
  return result[key] || null;
}

// Show notification
function showNotification(title, message) {
  // Only show notifications if permission is available
  if (chrome.notifications) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: title,
      message: message,
    });
  } else {
    console.log(`Notification: ${title} - ${message}`);
  }
}

// Update share statistics
async function updateShareStats() {
  try {
    const stats = await chrome.storage.local.get(["shareCount", "lastShared"]);
    const newCount = (stats.shareCount || 0) + 1;

    await chrome.storage.local.set({
      shareCount: newCount,
      lastShared: Date.now(),
    });

    console.log("Share stats updated:", { count: newCount });
  } catch (error) {
    console.error("Error updating stats:", error);
  }
}

// Update extension badge with share count
async function updateExtensionBadge() {
  try {
    const stats = await chrome.storage.local.get(["shareCount"]);
    const shareCount = stats.shareCount || 0;

    if (shareCount > 0) {
      // Show share count on badge
      await chrome.action.setBadgeText({ text: shareCount.toString() });
      await chrome.action.setBadgeBackgroundColor({ color: "#28a745" });

      // Flash the badge briefly when sharing
      setTimeout(async () => {
        try {
          await chrome.action.setBadgeBackgroundColor({ color: "#007bff" });
        } catch (error) {
          console.error("Error updating badge color:", error);
        }
      }, 1500);
    } else {
      // Clear badge if no shares
      await chrome.action.setBadgeText({ text: "" });
    }

    console.log("Badge updated with share count:", shareCount);
  } catch (error) {
    console.error("Error updating badge:", error);
    // Don't throw - badge update failure shouldn't break sharing
  }
}

// Handle messages from popup and web app
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", message);

  // Handle messages from web app (type-based)
  if (message.type === "auth-success") {
    console.log(
      "Received auth success notification from web app:",
      message.userId,
    );
    // Session is already in chrome.storage.local via shared storage adapter
    // No action needed - just log success
    showNotification("Login Successful", "You are now authenticated!");
    sendResponse({ success: true });
    return false;
  }

  // Handle messages from popup (action-based)
  switch (message.action) {
    case "share-page":
      shareCurrentPage()
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error("Error in shareCurrentPage:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep message channel open for async response

    case "share-page-from-content":
      console.log("Share request from content script:", message);
      shareCurrentPage()
        .then(() => {
          sendResponse({ success: true });

          // Send notification back to content script for in-page display
          if (sender.tab?.id) {
            chrome.tabs
              .sendMessage(sender.tab.id, {
                type: "share-success-notification",
                title: message.title || "Page",
              })
              .catch((error) => {
                console.log(
                  "Could not send notification to content script:",
                  error,
                );
              });
          }
        })
        .catch((error) => {
          console.error("Error sharing from content script:", error);
          sendResponse({ success: false, error: error.message });

          // Send error notification back to content script
          if (sender.tab?.id) {
            chrome.tabs
              .sendMessage(sender.tab.id, {
                type: "share-error-notification",
                error: error.message,
              })
              .catch((error) => {
                console.log(
                  "Could not send error notification to content script:",
                  error,
                );
              });
          }
        });
      return true;

    case "reload-extension":
      reloadExtension()
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error("Error in reloadExtension:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "get-stats":
      getExtensionStats()
        .then((stats) => sendResponse(stats))
        .catch((error) => {
          console.error("Error in getExtensionStats:", error);
          sendResponse({ error: error.message });
        });
      return true;

    case "get-groups":
      fetchUserGroups()
        .then((groups) => sendResponse({ success: true, groups }))
        .catch((error) => {
          console.error("Error in fetchUserGroups:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "select-group":
      saveSelectedGroupId(message.groupId)
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error("Error in saveSelectedGroupId:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "get-selected-group":
      getSelectedGroupId()
        .then((groupId) => sendResponse({ success: true, groupId }))
        .catch((error) => {
          console.error("Error in getSelectedGroupId:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "storage-get":
      console.log("[BRIDGE] Handling storage-get for key:", message.key);
      chrome.storage.local
        .get([message.key])
        .then((result) => {
          const value = result[message.key] ?? null;
          console.log("[BRIDGE] storage-get result:", {
            key: message.key,
            hasValue: !!value,
          });
          sendResponse(value);
        })
        .catch((error) => {
          console.error("[BRIDGE] storage-get error:", error);
          sendResponse(null);
        });
      return true;

    case "storage-set":
      console.log("[BRIDGE] Handling storage-set for key:", message.key);
      chrome.storage.local
        .set({ [message.key]: message.value })
        .then(() => {
          console.log("[BRIDGE] storage-set success:", message.key);
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error("[BRIDGE] storage-set error:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "storage-remove":
      console.log("[BRIDGE] Handling storage-remove for key:", message.key);
      chrome.storage.local
        .remove([message.key])
        .then(() => {
          console.log("[BRIDGE] storage-remove success:", message.key);
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error("[BRIDGE] storage-remove error:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "check-auth":
      console.log("[MESSAGE] Handling check-auth request");
      checkAuthStatus()
        .then((authStatus) => {
          const response = { success: true, ...authStatus };
          console.log("[MESSAGE] check-auth response:", response);
          sendResponse(response);
        })
        .catch((error) => {
          console.error("[MESSAGE] Error in checkAuthStatus:", error);
          const errorResponse = { success: false, error: error.message };
          console.log("[MESSAGE] check-auth error response:", errorResponse);
          sendResponse(errorResponse);
        });
      return true;

    case "store-chatgpt-conversation":
      console.log("[ChatGPT] Storing conversation:", message.conversation_id);
      storeChatGPTConversation(
        message.conversation_id,
        message.conversation,
        message.captured_at
      )
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error("[ChatGPT] Error storing conversation:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "login":
      redirectToLogin()
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error("Error in redirectToLogin:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "set-web-app-url":
      chrome.storage.sync
        .set({ webAppUrl: message.url })
        .then(() => {
          webAppUrl = message.url;
          console.log("Web app URL updated to:", webAppUrl);
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error("Error saving web app URL:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "get-web-app-url":
      sendResponse({ success: true, url: webAppUrl });
      return false;

    default:
      sendResponse({ error: "Unknown action" });
  }
});

// Handle messages from externally connectable web pages (localhost:3002, justshare.io)
chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    console.log("[EXTERNAL MESSAGE] Received from:", sender.origin, message);

    switch (message.action) {
      case "storage-get":
        console.log(
          "[BRIDGE] Handling external storage-get for key:",
          message.key,
        );
        chrome.storage.local
          .get([message.key])
          .then((result) => {
            const value = result[message.key] ?? null;
            console.log("[BRIDGE] External storage-get result:", {
              key: message.key,
              hasValue: !!value,
            });
            // Wrap response for external messages
            sendResponse({ value: value });
          })
          .catch((error) => {
            console.error("[BRIDGE] External storage-get error:", error);
            sendResponse({ value: null });
          });
        return true; // Keep channel open for async response

      case "storage-set":
        console.log(
          "[BRIDGE] Handling external storage-set for key:",
          message.key,
        );
        chrome.storage.local
          .set({ [message.key]: message.value })
          .then(() => {
            console.log("[BRIDGE] External storage-set success:", message.key);
            sendResponse({ success: true });
          })
          .catch((error) => {
            console.error("[BRIDGE] External storage-set error:", error);
            sendResponse({ success: false, error: error.message });
          });
        return true;

      case "storage-remove":
        console.log(
          "[BRIDGE] Handling external storage-remove for key:",
          message.key,
        );
        chrome.storage.local
          .remove([message.key])
          .then(() => {
            console.log(
              "[BRIDGE] External storage-remove success:",
              message.key,
            );
            sendResponse({ success: true });
          })
          .catch((error) => {
            console.error("[BRIDGE] External storage-remove error:", error);
            sendResponse({ success: false, error: error.message });
          });
        return true;

      default:
        console.log("[EXTERNAL MESSAGE] Unknown action:", message.action);
        sendResponse({ error: "Unknown action" });
        return false;
    }
  },
);

console.log("[EXTERNAL] External message listener ready");

// Get extension statistics
async function getExtensionStats() {
  try {
    const stats = await chrome.storage.local.get(["shareCount", "lastShared"]);
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    return {
      shareCount: stats.shareCount || 0,
      lastShared: stats.lastShared || null,
      currentUrl: tab?.url || null,
      isShareable: tab ? isShareableUrl(tab.url) : false,
    };
  } catch (error) {
    console.error("Error getting stats:", error);
    return {
      shareCount: 0,
      lastShared: null,
      currentUrl: null,
      isShareable: false,
    };
  }
}

console.log("Share extension background script initialized");

// ============================================================================
// DJ Player Offscreen Document Management
// ============================================================================

// Track the web app tab that initiated the DJ player for sending messages back
let djPlayerWebAppTabId: number | null = null;
let isOffscreenDocumentCreated = false;

// Ensure offscreen document exists for DJ player
async function ensureOffscreenDocument(): Promise<boolean> {
  if (isOffscreenDocumentCreated) {
    return true;
  }

  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [chrome.runtime.getURL("offscreen.html")],
    });

    if (existingContexts.length > 0) {
      console.log("[DJ] Offscreen document already exists");
      isOffscreenDocumentCreated = true;
      return true;
    }

    // Create offscreen document
    console.log("[DJ] Creating offscreen document...");
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "DJ app background audio playback for reliable video end detection",
    });

    isOffscreenDocumentCreated = true;
    console.log("[DJ] Offscreen document created successfully");
    return true;
  } catch (error) {
    console.error("[DJ] Error creating offscreen document:", error);
    isOffscreenDocumentCreated = false;
    return false;
  }
}

// Close offscreen document when no longer needed
async function closeOffscreenDocument(): Promise<void> {
  if (!isOffscreenDocumentCreated) {
    return;
  }

  try {
    await chrome.offscreen.closeDocument();
    isOffscreenDocumentCreated = false;
    console.log("[DJ] Offscreen document closed");
  } catch (error) {
    console.error("[DJ] Error closing offscreen document:", error);
  }
}

// Forward message to offscreen document
async function sendToOffscreen(message: any): Promise<any> {
  console.log("[DJ] Sending to offscreen:", message.action, JSON.stringify(message));
  try {
    const response = await chrome.runtime.sendMessage(message);
    console.log("[DJ] Offscreen response:", JSON.stringify(response));
    return response;
  } catch (error) {
    console.error("[DJ] Error sending to offscreen:", error);
    throw error;
  }
}

// Send message back to web app via external messaging
async function sendToWebApp(message: any): Promise<void> {
  if (!djPlayerWebAppTabId) {
    console.warn("[DJ] No web app tab ID registered");
    return;
  }

  // Don't log time updates to avoid spam (they happen every second)
  if (message.action !== "dj-time-update") {
    console.log("[DJ] Sending to web app:", message.action, JSON.stringify(message));
  }

  try {
    await chrome.tabs.sendMessage(djPlayerWebAppTabId, message);
  } catch (error) {
    console.error("[DJ] Error sending to web app:", error);
    // Tab might be closed, clear the ID
    djPlayerWebAppTabId = null;
  }
}

// Helper to forward logs to web app console
function logToWebApp(level: "log" | "warn" | "error", ...args: any[]) {
  console[level]("[DJ]", ...args);
  sendToWebApp({
    action: "dj-log",
    level,
    message: args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "),
    timestamp: Date.now(),
  });
}

// Handle DJ player messages from offscreen document
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only handle DJ messages from offscreen document
  if (!message.action?.startsWith("dj-")) {
    return false; // Let other handlers process
  }

  // Messages from offscreen to forward to web app
  if (sender.url?.includes("offscreen.html")) {
    console.log("[DJ] Message from offscreen:", message.action);

    switch (message.action) {
      case "dj-player-ready":
        logToWebApp("log", "Offscreen player ready");
        sendToWebApp({ action: "dj-player-ready" });
        break;

      case "dj-video-ended":
        logToWebApp("log", "Video ended at index:", message.video_index);
        sendToWebApp({
          action: "dj-video-ended",
          video_index: message.video_index,
        });
        break;

      case "dj-time-update":
        sendToWebApp({
          action: "dj-time-update",
          current_time: message.current_time,
          duration: message.duration,
        });
        break;

      case "dj-state-changed":
        sendToWebApp({
          action: "dj-state-changed",
          is_playing: message.is_playing,
          duration: message.duration,
        });
        break;

      case "dj-error":
        logToWebApp("error", "Player error:", message.error, "code:", message.error_code);
        sendToWebApp({
          action: "dj-error",
          error: message.error,
          error_code: message.error_code,
        });
        break;
    }

    sendResponse({ received: true });
    return false;
  }

  return false;
});

// Handle DJ player commands from web app (external messages)
// Add to the existing onMessageExternal listener
const originalExternalListener = chrome.runtime.onMessageExternal.hasListeners();

chrome.runtime.onMessageExternal.addListener(
  async (message, sender, sendResponse) => {
    // Only handle DJ messages
    if (!message.action?.startsWith("dj-")) {
      return false;
    }

    console.log("[DJ] External message from web app:", message.action, "tabId:", sender.tab?.id, "payload:", JSON.stringify(message));

    // Store the sender tab ID for sending responses back
    if (sender.tab?.id) {
      djPlayerWebAppTabId = sender.tab.id;
    }

    try {
      switch (message.action) {
        case "dj-init": {
          // Initialize the offscreen document
          const success = await ensureOffscreenDocument();
          sendResponse({ success, is_ready: isOffscreenDocumentCreated });
          break;
        }

        case "dj-load-video": {
          await ensureOffscreenDocument();
          const response = await sendToOffscreen({
            action: "player-load",
            url: message.url,
            video_id: message.video_id,
            start_time: message.start_time,
            video_index: message.video_index,
          });
          sendResponse(response);
          break;
        }

        case "dj-play": {
          const response = await sendToOffscreen({ action: "player-play" });
          sendResponse(response);
          break;
        }

        case "dj-pause": {
          const response = await sendToOffscreen({ action: "player-pause" });
          sendResponse(response);
          break;
        }

        case "dj-seek": {
          const response = await sendToOffscreen({
            action: "player-seek",
            time: message.time,
          });
          sendResponse(response);
          break;
        }

        case "dj-set-rate": {
          const response = await sendToOffscreen({
            action: "player-set-rate",
            rate: message.rate,
          });
          sendResponse(response);
          break;
        }

        case "dj-get-state": {
          const response = await sendToOffscreen({ action: "player-get-state" });
          sendResponse(response);
          break;
        }

        case "dj-stop": {
          const response = await sendToOffscreen({ action: "player-stop" });
          sendResponse(response);
          break;
        }

        case "dj-close": {
          await closeOffscreenDocument();
          djPlayerWebAppTabId = null;
          sendResponse({ success: true });
          break;
        }

        default:
          console.log("[DJ] Unknown DJ action:", message.action);
          sendResponse({ success: false, error: "Unknown action" });
      }
    } catch (error: any) {
      console.error("[DJ] Error handling DJ message:", error);
      sendResponse({ success: false, error: error.message });
    }

    return true; // Keep message channel open for async response
  }
);

console.log("[DJ] DJ player orchestration initialized");
