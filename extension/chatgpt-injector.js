// ChatGPT Conversation Interceptor - MAIN world script
// Intercepts fetch requests to capture conversation API responses

(function() {
  'use strict';

  console.log('[ChatGPT Injector] Loaded in MAIN world');

  // UUID regex pattern
  const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  // API URL pattern: /backend-api/conversation/{uuid}
  const CONVERSATION_API_PATTERN = /\/backend-api\/conversation\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

  // Store original fetch
  const originalFetch = window.fetch;

  // Override fetch to intercept conversation API responses
  window.fetch = async function(...args) {
    const [resource, config] = args;

    // Get the URL string
    let url = '';
    if (typeof resource === 'string') {
      url = resource;
    } else if (resource instanceof Request) {
      url = resource.url;
    } else if (resource instanceof URL) {
      url = resource.href;
    }

    // Call original fetch
    const response = await originalFetch.apply(this, args);

    // Check if this is a conversation API request
    const match = url.match(CONVERSATION_API_PATTERN);
    if (match && response.ok) {
      const conversationId = match[1];
      console.log('[ChatGPT Injector] Intercepted conversation API:', conversationId);

      try {
        // Clone the response so we can read it without consuming
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();

        // Send to bridge script via postMessage
        window.postMessage({
          type: 'chatgpt-conversation',
          conversation_id: conversationId,
          conversation: data,
          captured_at: new Date().toISOString(),
          url: url
        }, '*');

        console.log('[ChatGPT Injector] Sent conversation to bridge:', conversationId);
      } catch (error) {
        console.error('[ChatGPT Injector] Error parsing conversation:', error);
      }
    }

    return response;
  };

  console.log('[ChatGPT Injector] Fetch interceptor installed');
})();
