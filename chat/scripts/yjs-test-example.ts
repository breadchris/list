#!/usr/bin/env tsx
/**
 * Example test workflow using the Yjs test utilities
 * This demonstrates how an AI tool like Claude can drive interactions
 *
 * Usage:
 *   npx tsx scripts/yjs-test-example.ts
 */

import {
  connectToYSweet,
  DocumentManager,
  Observer,
  sendMessage,
  createThreadForMessage,
  addTagToMessage,
  queryMessages,
  getDocumentState,
  getThreadWithMessages,
} from '../lib/test-utils';

// Polyfill WebSocket for Node.js
(globalThis as any).WebSocket = require('ws');

async function runExample() {
  console.log('=== Yjs Test Utility Example ===\n');

  // Configuration
  const authEndpoint = process.env.AUTH_ENDPOINT || 'http://localhost:3000/api/y-sweet-auth';
  const docId = process.env.DOC_ID || 'chat-session-chat';

  console.log('Connecting to:');
  console.log(`  Auth Endpoint: ${authEndpoint}`);
  console.log(`  Document ID: ${docId}\n`);

  // Connect to Y-Sweet
  const { doc, disconnect } = await connectToYSweet({
    auth_endpoint: authEndpoint,
    doc_id: docId,
  });

  // Create document manager and observer
  const docManager = new DocumentManager(doc);
  const observer = new Observer(docManager);

  // Subscribe to events
  observer.subscribe((event) => {
    console.error(JSON.stringify(event));
  });

  try {
    // Wait a bit for initial sync
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 1. Get initial state
    console.log('1. Getting initial document state...');
    let state = getDocumentState(docManager);
    console.log(`   Found ${state.messages.length} messages\n`);

    // 2. Send a regular message
    console.log('2. Sending a regular message...');
    const result1 = sendMessage(docManager, 'test-user', 'Hello from TypeScript test!');
    console.log(`   Message ID: ${result1.message.id}\n`);

    // 3. Send a message with @bot mention
    console.log('3. Sending message with @ai bot mention...');
    const result2 = sendMessage(docManager, 'test-user', '@ai What is 2+2?');
    console.log(`   Message ID: ${result2.message.id}`);
    console.log(`   Bot invocations created: ${result2.botInvocations.length}\n`);

    // 4. Query messages by username
    console.log('4. Querying messages by username "test-user"...');
    const userMessages = queryMessages(docManager, { username: 'test-user' });
    console.log(`   Found ${userMessages.length} messages\n`);

    // 5. Create a thread
    console.log('5. Creating a thread for the first message...');
    const thread = createThreadForMessage(docManager, result1.message.id);
    if (thread) {
      console.log(`   Thread ID: ${thread.id}\n`);

      // 6. Send a message in the thread
      console.log('6. Sending a message in the thread...');
      const result3 = sendMessage(docManager, 'test-user', 'This is a threaded reply', {
        threadId: thread.id,
      });
      console.log(`   Thread message ID: ${result3.message.id}\n`);

      // 7. Get thread with all messages
      console.log('7. Getting thread with all its messages...');
      const threadData = getThreadWithMessages(docManager, thread.id);
      if (threadData) {
        console.log(`   Thread has ${threadData.messages.length} messages\n`);
      }
    }

    // 8. Add a tag to a message
    console.log('8. Adding "important" tag to first message...');
    const tagAdded = addTagToMessage(docManager, result1.message.id, 'important');
    console.log(`   Tag added: ${tagAdded}\n`);

    // 9. Query messages by tag
    console.log('9. Querying messages with "important" tag...');
    const taggedMessages = queryMessages(docManager, { hasTag: 'important' });
    console.log(`   Found ${taggedMessages.length} messages with tag\n`);

    // 10. Get final state
    console.log('10. Getting final document state...');
    state = getDocumentState(docManager);
    console.log(JSON.stringify({
      message_count: state.messages.length,
      thread_count: state.threads.length,
      tag_count: state.tags.length,
      bot_count: state.bots.length,
    }, null, 2));
    console.log('');

    console.log('=== Test Complete ===\n');
    console.log('Summary:');
    console.log('  - Sent regular message');
    console.log('  - Sent message with @bot mention');
    console.log('  - Created thread');
    console.log('  - Sent threaded reply');
    console.log('  - Added tag');
    console.log('  - Queried messages by username, tag, and thread\n');
    console.log('All operations completed successfully!');

  } finally {
    // Wait a bit for sync before disconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    disconnect();
  }
}

// Run the example
runExample().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
