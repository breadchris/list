# Yjs Test Utilities

A stratified design test utility for interacting with Yjs collaborative documents from Node.js CLI.

## Quick Start

```bash
# Install dependencies
npm install

# Send a message
npm run test:yjs send-message --username "alice" --content "Hello world"

# Get current state
npm run test:yjs get-state

# Help
npm run test:yjs help
```

## Architecture

This library uses **stratified design** with three distinct layers:

### Layer 1: Core Business Logic (Pure Functions)
- **Location**: `lib/test-utils/core/`
- **Purpose**: Pure functions with no dependencies on Yjs or React
- **Files**:
  - `message-operations.ts` - Create, update, query messages
  - `thread-operations.ts` - Thread management
  - `bot-operations.ts` - Bot mention parsing and context building

### Layer 2: Yjs Integration
- **Location**: `lib/test-utils/yjs/`
- **Purpose**: Connect core logic to Yjs document operations
- **Files**:
  - `client.ts` - Y-Sweet WebSocket connection
  - `document-manager.ts` - Typed Yjs array access
  - `observer.ts` - Event tracking and JSON logging
  - `operations.ts` - High-level operations (sendMessage, createThread, etc.)

### Layer 3: CLI Interface
- **Location**: `scripts/yjs-test-cli.ts`
- **Purpose**: Command-line driver for AI/automation tools
- **Output**: JSON to stdout, events to stderr

## Usage Examples

### CLI Usage (TypeScript)

All commands are run using TypeScript via tsx:

```bash
# Environment variables (optional)
export AUTH_ENDPOINT=http://localhost:3000/api/y-sweet-auth
export DOC_ID=chat-session-chat

# Send message with bot mention
npx tsx scripts/yjs-test-cli.ts send-message \
  --username "test-user" \
  --content "@ai What is quantum computing?"

# Or use the npm script shortcut
npm run test:yjs send-message --username "alice" --content "Hello"

# Query messages
npm run test:yjs query --username "alice"
npm run test:yjs query --contentContains "hello"
npm run test:yjs query --hasTag "important"

# Observe events
npm run test:yjs observe --duration 30000
npm run test:yjs wait-for-event --eventType "message_added"

# Run the complete example
npx tsx scripts/yjs-test-example.ts
```

### Programmatic Usage

```typescript
import {
  connectToYSweet,
  DocumentManager,
  Observer,
  sendMessage,
  queryMessages,
} from '@/lib/test-utils';

// Connect
const { doc, disconnect } = await connectToYSweet({
  auth_endpoint: 'http://localhost:3000/api/y-sweet-auth',
  doc_id: 'chat-session-chat',
});

// Create manager and observer
const docManager = new DocumentManager(doc);
const observer = new Observer(docManager);

// Send message
const result = sendMessage(docManager, 'alice', 'Hello!');

// Query
const messages = queryMessages(docManager, { username: 'alice' });

// Cleanup
disconnect();
```

## Why Stratified Design?

1. **Code Reuse**: UI and CLI share the same business logic
2. **Testability**: Pure functions can be tested in isolation
3. **Separation of Concerns**: UI rendering separate from data operations
4. **AI-Friendly**: JSON CLI interface for automation
5. **Type Safety**: Full TypeScript support across all layers

## Event Types

The observer tracks these Yjs document events:

- `message_added` / `message_updated` / `message_deleted`
- `thread_added` / `thread_updated` / `thread_deleted`
- `tag_added` / `tag_deleted`
- `bot_added` / `bot_updated` / `bot_deleted`

## Testing with AI Tools

This utility is designed for AI development tools (like Claude) to:

1. **Send messages** - Simulate user interactions
2. **Invoke bots** - Test @bot mentions and responses
3. **Observe events** - Wait for async operations to complete
4. **Query state** - Assert expected document state
5. **Verify results** - Check message content, threads, tags

See `tests/CLAUDE.md` for detailed testing guidelines.
