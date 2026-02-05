// ChatGPT Bridge Script - ISOLATED world script
// Listens for postMessage from MAIN world and forwards to background script

(function() {
  'use strict';

  console.log('[ChatGPT Bridge] Loaded in ISOLATED world');

  // Listen for messages from the MAIN world injector
  window.addEventListener('message', async (event) => {
    // Only accept messages from the same window
    if (event.source !== window) {
      return;
    }

    // Only handle our specific message type
    if (event.data && event.data.type === 'chatgpt-conversation') {
      console.log('[ChatGPT Bridge] Received conversation:', event.data.conversation_id);

      try {
        // Forward to background script
        const response = await chrome.runtime.sendMessage({
          action: 'store-chatgpt-conversation',
          conversation_id: event.data.conversation_id,
          conversation: event.data.conversation,
          captured_at: event.data.captured_at,
          url: event.data.url
        });

        if (response && response.success) {
          console.log('[ChatGPT Bridge] Conversation stored successfully:', event.data.conversation_id);
        } else {
          console.error('[ChatGPT Bridge] Failed to store conversation:', response?.error);
        }
      } catch (error) {
        console.error('[ChatGPT Bridge] Error sending to background:', error);
      }
    }
  });

  console.log('[ChatGPT Bridge] Message listener installed');
})();
