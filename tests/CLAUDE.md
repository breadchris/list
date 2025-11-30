# Testing Guidelines

## Test Authentication Guidelines

**CRITICAL**: Always use form-based authentication in tests

### Authentication Approach for Tests
- **NEVER use localStorage mocking** - causes inconsistent state and test failures
- **ALWAYS use real form-based authentication** - tests actual user flow
- **Form interaction pattern**: Click "Continue with email" → Fill email/password → Submit form
- **Wait for auth completion**: Wait for "Sign in to your account" text to disappear

### Correct Test Authentication Pattern
```typescript
import { AuthHelper } from './helpers/auth';
import { createTestUserWithInvites } from './helpers/invite-test-data';

const authHelper = new AuthHelper();
const user = createTestUserWithInvites('test-user');
const userId = await databaseHelper.createTestUser(user);

// Use form-based authentication
await authHelper.loginProgrammatically(page, user.email, user.password);

// Verify authentication worked
const isAuthenticated = await authHelper.isLoggedIn(page);
if (!isAuthenticated) {
  throw new Error('Authentication failed - test cannot proceed');
}
```

### Authentication Implementation Details
- Tests use real Supabase authentication through the UI form
- Test users created in database with known passwords
- Authentication detection via auth form disappearance
- Handles social login UI (clicks "Continue with email" to reveal form)
- More reliable than programmatic authentication for UI testing

### Test Result Configuration
- Test results saved to `./data/test-results/`
- HTML reports in `./data/playwright-report/`
- Screenshots and videos captured on failure for debugging

## Testing Configuration

**CRITICAL**: Playwright test results are saved to `./data/` directory

### Test Output Configuration
- Test results: `./data/test-results/`
- HTML reports: `./data/playwright-report/`
- Screenshots and videos on failure stored in test results
- Tests run against local Supabase instance (`http://127.0.0.1:54321`)
- Frontend tests run against `http://localhost:3004`

### Running Tests
```bash
npm run test:e2e                    # Run all E2E tests
npm run test:e2e:headed            # Run with browser UI visible
npm run test:e2e:ui                # Run with Playwright UI
npm run test:e2e -- tests/specific-test.spec.ts  # Run specific test
```

### Test Data Management
- Tests use DatabaseHelper for setup and cleanup
- Test users created with unique identifiers to prevent conflicts
- All test data automatically cleaned up after test completion

### Known Issues
- **Authentication mocking broken**: localStorage approach no longer works with current Supabase version
- Tests gracefully skip when authentication fails to prevent false failures
- localStorage.setItem('supabase.auth.token', ...) doesn't authenticate users
- Investigation needed for proper Supabase v2 session format or alternative mocking approach

---

## Yjs Test Utility

**CRITICAL**: For testing chat and Yjs document interactions, use the CLI test utility

### Overview
The Yjs test utility is a Node.js CLI tool that connects to the Y-Sweet collaborative document server and allows programmatic interaction with chat messages, threads, and bot invocations. It uses **stratified design** to separate UI from business logic, enabling both UI and CLI to share the same core functionality.

### Architecture Layers

#### Layer 1: Core Business Logic (Pure Functions)
Located in `lib/test-utils/core/`:
- `message-operations.ts` - Message CRUD operations
- `thread-operations.ts` - Thread management
- `bot-operations.ts` - Bot mention parsing and context building

These are pure functions with no Yjs or React dependencies - they can be used in any context.

#### Layer 2: Yjs Integration
Located in `lib/test-utils/yjs/`:
- `client.ts` - Y-Sweet WebSocket connection from Node.js
- `document-manager.ts` - Typed access to Yjs arrays
- `observer.ts` - Event tracking with JSON logging
- `operations.ts` - High-level operations combining business logic + Yjs updates

#### Layer 3: CLI Interface
- `scripts/yjs-test-cli.ts` - Command-line driver for automation

### Installation

Install required dependencies:
```bash
npm install
```

The utility requires these dev dependencies:
- `ws` - WebSocket client for Node.js
- `tsx` - TypeScript execution for Node.js
- `@types/ws` - TypeScript types for ws

### Usage

#### Environment Variables
```bash
# Y-Sweet auth endpoint (default: http://localhost:3000/api/y-sweet-auth)
export AUTH_ENDPOINT=http://localhost:3000/api/y-sweet-auth

# Document ID to connect to (default: test-session)
export DOC_ID=chat-session-chat
```

#### Basic Commands

All commands use TypeScript via tsx. Use npm script shortcut or run directly:

**Send a message:**
```bash
npm run test:yjs send-message --username "alice" --content "Hello world"
# Or directly: npx tsx scripts/yjs-test-cli.ts send-message --username "alice" --content "Hello"
```

**Send a message with @bot mention:**
```bash
npm run test:yjs send-message --username "bob" --content "@ai What is 2+2?"
```

**Create a thread:**
```bash
npm run test:yjs create-thread --messageId "1234567890-abc123"
```

**Add a tag to a message:**
```bash
npm run test:yjs add-tag --messageId "1234567890-abc123" --tag "important"
```

**Query messages:**
```bash
# By username
npm run test:yjs query --username "alice"

# By content substring
npm run test:yjs query --contentContains "hello"

# By tag
npm run test:yjs query --hasTag "important"

# In a specific thread
npm run test:yjs query --inThread "thread-id-123"
```

**Get current document state:**
```bash
npm run test:yjs get-state
```

**Observe events for a duration:**
```bash
# Observe for 30 seconds
npm run test:yjs observe --duration 30000
```

**Wait for a specific event:**
```bash
npm run test:yjs wait-for-event --eventType "message_added" --timeout 10000
```

**Run the complete example:**
```bash
npx tsx scripts/yjs-test-example.ts
```

### Output Format

All commands output JSON to stdout:
```json
{
  "success": true,
  "data": {
    "message": {
      "id": "1732729200000-abc123",
      "username": "alice",
      "timestamp": "14:20",
      "content": "Hello world"
    }
  }
}
```

Events are logged to stderr as JSON objects:
```json
{
  "type": "message_added",
  "timestamp": "2025-11-27T14:20:00.000Z",
  "data": {
    "message": {
      "id": "1732729200000-abc123",
      "username": "alice",
      "content": "Hello world"
    },
    "index": 0
  }
}
```

### Event Types

The observer tracks these event types:
- `message_added` - New message added
- `message_updated` - Message modified
- `message_deleted` - Message removed
- `thread_added` - New thread created
- `thread_updated` - Thread modified
- `thread_deleted` - Thread removed
- `tag_added` - Tag added to global tags
- `tag_deleted` - Tag removed
- `bot_added` - Dynamic bot created
- `bot_updated` - Bot configuration modified
- `bot_deleted` - Bot removed

### Programmatic Usage

You can also import the test utilities in TypeScript/JavaScript:

```typescript
import {
  connectToYSweet,
  DocumentManager,
  Observer,
  sendMessage,
  queryMessages,
  getDocumentState,
} from '@/lib/test-utils';

// Connect to Y-Sweet
const { doc, disconnect } = await connectToYSweet({
  auth_endpoint: 'http://localhost:3000/api/y-sweet-auth',
  doc_id: 'chat-session-chat',
});

// Create document manager and observer
const docManager = new DocumentManager(doc);
const observer = new Observer(docManager);

// Subscribe to events
observer.subscribe((event) => {
  console.log('Event:', event);
});

// Send a message
const result = sendMessage(docManager, 'alice', 'Hello world');
console.log('Message sent:', result.message);

// Query messages
const messages = queryMessages(docManager, { username: 'alice' });
console.log('Found messages:', messages);

// Get current state
const state = getDocumentState(docManager);
console.log('Document state:', state);

// Cleanup
disconnect();
```

### Testing Bot Interactions

The utility automatically detects @bot mentions and creates bot invocations:

```bash
# Send message with bot mention
npm run test:yjs send-message \
  --username "test-user" \
  --content "@ai Explain quantum computing"

# Output includes bot_invocations array
{
  "success": true,
  "data": {
    "message": { ... },
    "bot_invocations": [
      {
        "id": "inv-1732729200000-xyz789",
        "bot": { "mention": "ai", ... },
        "prompt": "[test-user]: Explain quantum computing",
        "trigger_message_id": "1732729200000-abc123",
        "status": "pending",
        "context_messages": []
      }
    ]
  }
}
```

### Example AI Test Workflow

An AI development tool (like Claude) can use this CLI to:

1. **Setup**: Connect to the Yjs document
2. **Action**: Send messages, create threads, invoke bots
3. **Observe**: Wait for events (bot responses, message updates)
4. **Verify**: Query document state to assert expected results
5. **Cleanup**: Disconnect and report results

Example programmatic test (TypeScript):
```typescript
import {
  connectToYSweet,
  DocumentManager,
  Observer,
  sendMessage,
  queryMessages,
  getDocumentState,
} from '@/lib/test-utils';

// Connect to Y-Sweet
const { doc, disconnect } = await connectToYSweet({
  auth_endpoint: 'http://localhost:3000/api/y-sweet-auth',
  doc_id: 'chat-session-chat',
});

const docManager = new DocumentManager(doc);
const observer = new Observer(docManager);

// Send message with bot mention
const result = sendMessage(docManager, 'tester', '@ai What is the capital of France?');
console.log('Message sent:', result.message.id);
console.log('Bot invocations:', result.botInvocations.length);

// Wait for bot response
const event = await observer.waitForEvent('message_added', 30000);
console.log('Event received:', event);

// Verify bot responded
const aiMessages = queryMessages(docManager, { username: 'ai' });
console.log('AI messages:', aiMessages);

disconnect();
```

See `scripts/yjs-test-example.ts` for a complete working example.

### Directory Structure

```
lib/test-utils/
  core/                      # Layer 1: Pure business logic
    message-operations.ts
    thread-operations.ts
    bot-operations.ts
  yjs/                       # Layer 2: Yjs integration
    client.ts
    document-manager.ts
    observer.ts
    operations.ts
  types.ts                   # Shared TypeScript types
  index.ts                   # Main export file

scripts/
  yjs-test-cli.ts            # Layer 3: CLI interface
```

### Benefits of Stratified Design

1. **Code Reuse**: UI and CLI share the same business logic
2. **Testability**: Pure functions can be tested independently
3. **Separation of Concerns**: UI rendering separate from data operations
4. **AI-Friendly**: CLI provides JSON interface for automation
5. **Type Safety**: Full TypeScript support across all layers
