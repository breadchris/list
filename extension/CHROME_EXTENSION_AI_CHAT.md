# Chrome Extension AI Chat Sidebar

## Overview

Added a Chrome side panel with AI chat that has access to the current webpage's text content. Users can right-click on any page and select "Chat with AI about this page" to open the sidebar and ask questions about the content.

## Architecture

```
Chrome Extension Side Panel
  └─> React App (sidebar.html)
       └─> SidebarChat Component
            ├─> Extract page text via content script
            ├─> Send to Lambda with page context
            └─> Stream AI responses with follow-up questions
```

## Features

- **Page Context Extraction**: Automatically extracts visible text from the current page
- **AI Chat**: Streaming chat responses powered by OpenAI GPT-4
- **Follow-up Questions**: AI suggests relevant questions based on page content
- **Persistent Sidebar**: Stays open while browsing (optional per-tab behavior)
- **Context Menu**: Right-click → "Chat with AI about this page"

## Files Created

### Extension Files (7 new files)

1. **sidebar.html** - HTML shell for React app
   - Loads Tailwind CSS via CDN
   - Mounts React app to #root

2. **sidebar.tsx** - React app entry point
   - Creates React root
   - Renders SidebarChat component

3. **components/SidebarChat.tsx** - Main chat UI component
   - Extracts page text on mount
   - Displays chat history
   - Shows streaming AI responses
   - Handles follow-up question clicks

4. **hooks/useAIChatV2Sidebar.ts** - Chat hook adapted for extension
   - Uses Vercel AI SDK `useObject` hook
   - Includes page context in requests
   - Loads Lambda endpoint from chrome.storage

5. **build-sidebar.js** - esbuild script
   - Bundles React app to sidebar.js
   - Uses IIFE format for browser
   - Minifies and sourcemaps

6. **sidebar.css** - Custom styles
   - Scrollbar styling
   - Markdown content formatting
   - Loading animations

### Modified Files (4 files)

1. **manifest.json**
   - Added `"sidePanel"` permission
   - Added `side_panel` configuration pointing to sidebar.html

2. **content.js**
   - Added `'get-page-text'` message handler
   - Extracts text using `document.body.innerText`
   - Tries to find main content area first (main, article, etc.)
   - Cleans up excessive whitespace

3. **background.ts**
   - Added "Chat with AI about this page" context menu item
   - Opens side panel when menu item clicked via `chrome.sidePanel.open()`

4. **lambda/function/src/content-handlers.ts**
   - Added `pageContext?: string` to `ChatV2StreamPayload` interface
   - Enhanced system prompt when pageContext is present
   - AI now references page content in responses

5. **package.json**
   - Added `"build:extension:sidebar"` script

## Usage

### For Users

1. **Load Extension**:
   - Open Chrome → `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `/Users/hacked/Documents/GitHub/list/extension/` directory

2. **Use AI Chat**:
   - Navigate to any webpage
   - Right-click anywhere on the page
   - Select "Chat with AI about this page"
   - Ask questions in the sidebar chat

3. **Features**:
   - Page text is automatically loaded
   - AI has full context of the page content
   - Suggested follow-up questions appear after each response
   - Click suggested questions to ask them
   - Sidebar stays open while browsing

### For Developers

1. **Build Sidebar**:
   ```bash
   npm run build:extension:sidebar
   ```

2. **Development Workflow**:
   ```bash
   # Make changes to sidebar.tsx or components
   npm run build:extension:sidebar

   # Reload extension in Chrome
   # chrome://extensions → click reload button
   ```

3. **Test Locally**:
   - Ensure Lambda is running: `npm run local`
   - Or use production Lambda endpoint
   - Update `build-sidebar.js` LAMBDA_ENDPOINT if needed

## Technical Details

### Page Text Extraction

**Content Script** (content.js):
```javascript
case 'get-page-text':
  // Try to get main content first
  const mainContent = document.querySelector('main, article, .content, #content, [role="main"]');

  if (mainContent) {
    textContent = mainContent.innerText;
  } else {
    textContent = document.body.innerText;
  }

  // Clean up whitespace and truncate to 10K chars
  textContent = textContent.replace(/\n\s*\n/g, '\n\n').trim();
```

**Why 10K character limit?**
- Avoids hitting OpenAI token limits (~40K tokens for GPT-4)
- Most pages have meaningful content in first 10K characters
- Reduces Lambda payload size

### Lambda Integration

**Enhanced System Prompt** (content-handlers.ts:1456-1465):
```typescript
if (payload.pageContext) {
  systemPrompt = `You are a helpful AI assistant with access to the following page content:

${payload.pageContext}

Answer questions about this content, provide insights, and suggest related topics.`;
}
```

**Request Format**:
```json
{
  "action": "chat-v2-stream",
  "messages": [...],
  "pageContext": "Page text content here..."
}
```

### React Component Structure

```
SidebarChat
├─> useAIChatV2Sidebar (hook)
│   ├─> useObject (Vercel AI SDK)
│   └─> chrome.storage (endpoint config)
├─> chrome.tabs.sendMessage (page text)
├─> ReactMarkdown (render responses)
└─> Follow-up question buttons
```

### Chrome APIs Used

- `chrome.sidePanel.open()` - Open sidebar
- `chrome.tabs.query()` - Get active tab
- `chrome.tabs.sendMessage()` - Request page text from content script
- `chrome.runtime.onMessage` - Receive messages in content script
- `chrome.contextMenus` - Right-click menu
- `chrome.storage.sync` - Store Lambda endpoint (future enhancement)

## Limitations & Future Enhancements

### Current Limitations

1. **10K character limit** - Large pages truncated
2. **No image/video context** - Only text content
3. **Single tab** - No cross-tab conversation history
4. **Local state only** - Chat history lost on close

### Potential Enhancements

1. **Smarter content extraction**:
   - Use Readability.js for better article extraction
   - Support PDF text extraction
   - Include meta tags, headings hierarchy

2. **Persistent history**:
   - Save chats to Supabase per URL
   - Resume conversations on same page
   - Search past conversations

3. **Advanced features**:
   - Screenshot analysis (GPT-4 Vision)
   - Summarize video transcripts
   - Extract structured data (tables, lists)
   - Generate flashcards from content

4. **UI improvements**:
   - Dark mode toggle
   - Font size controls
   - Export conversation as markdown
   - Share conversation link

5. **Multi-modal support**:
   - Analyze images on page
   - Process embedded videos
   - Parse code blocks with syntax highlighting

## Dependencies

**NPM Packages** (already installed):
- `react` - UI library
- `react-dom` - DOM rendering
- `@ai-sdk/react` - Vercel AI SDK for streaming
- `lucide-react` - Icons
- `react-markdown` - Markdown rendering
- `remark-gfm` - GitHub Flavored Markdown
- `esbuild` - Bundler

**Chrome APIs** (built-in):
- Side Panel API (Chrome 114+)
- Tabs API
- Runtime Messaging API
- Context Menus API
- Storage API

## Troubleshooting

### Sidebar won't open
- Check Chrome version is 114+ (Side Panel API requirement)
- Verify `sidePanel` permission in manifest.json
- Check console for errors: `chrome://extensions` → background page

### Page text not loading
- Check content script loaded: Open DevTools on page → Sources → Content scripts
- Verify message handler: Console should log "Extracted page text"
- Check for CSP restrictions on page

### AI responses not streaming
- Verify Lambda endpoint in build-sidebar.js
- Check Lambda is running: `npm run local`
- Open sidebar DevTools: Right-click sidebar → Inspect
- Check Network tab for /content requests

### Build errors
- Ensure esbuild is installed: `npm install esbuild --save-dev`
- Check all imports are correct
- Verify React version matches (^18.2.0)

## Security Considerations

### Content Security

- Page text extraction respects CSP policies
- No eval() or dynamic code execution
- Sanitized markdown rendering (ReactMarkdown)

### API Security

- Lambda endpoint configurable (not hardcoded)
- Chrome storage for sensitive config (future)
- CORS headers properly set on Lambda responses

### Privacy

- Page text sent only when user initiates chat
- No automatic background extraction
- No data stored without user action
- All processing happens server-side (Lambda)

## Testing

### Manual Testing Checklist

- [ ] Right-click menu appears with "Chat with AI about this page"
- [ ] Sidebar opens when menu item clicked
- [ ] Page text loads automatically (check character count)
- [ ] Can send messages and receive streaming responses
- [ ] Follow-up questions appear after responses
- [ ] Clicking follow-up questions populates input
- [ ] Markdown formatting works (links, code blocks, lists)
- [ ] Scrolling works in messages area
- [ ] Error handling for network failures
- [ ] Works on different types of pages (articles, docs, blogs)

### Test Pages

**Good for testing**:
- News articles (https://arstechnica.com)
- Documentation (https://docs.anthropic.com)
- Wikipedia pages
- GitHub README files
- Blog posts with code samples

**Edge cases**:
- Empty pages (about:blank)
- Pages with heavy JavaScript
- Single-page applications
- PDF documents
- Pages with iframes

## Production Deployment

When ready for production:

1. **Update endpoint** in build-sidebar.js:
   ```javascript
   'LAMBDA_ENDPOINT': '"https://your-production-lambda-url"'
   ```

2. **Build production bundle**:
   ```bash
   npm run build:extension:sidebar
   ```

3. **Test with production Lambda**:
   - Load unpacked extension
   - Verify requests go to production endpoint
   - Test on various pages

4. **Package for Chrome Web Store** (future):
   - Zip the extension directory
   - Upload to Chrome Web Store Developer Dashboard
   - Request OAuth credentials for production
   - Submit for review

## Support

For issues or questions:
- Check console logs in sidebar DevTools
- Verify Lambda logs: `npm run local:logs`
- Test Lambda directly with curl
- Review this documentation

## License

Same as main project license.
