#!/usr/bin/env node
/**
 * Test script to validate the self-hosted Y-Sweet server on ECS Fargate.
 *
 * Tests:
 *   1. Server connectivity (DocumentManager can reach the server)
 *   2. Document creation
 *   3. Write and read document content via Yjs updates
 *   4. Two-client sync via Y-Sweet provider
 *
 * Usage:
 *   CONNECTION_STRING=ys://...@host tsx scripts/test-y-sweet-server.ts
 *
 * The CONNECTION_STRING env var should point to the self-hosted Y-Sweet server.
 * Falls back to .env.local if not set.
 */

import { DocumentManager } from '@y-sweet/sdk';
import { createYjsProvider } from '@y-sweet/client';
import * as Y from 'yjs';

// Polyfill WebSocket for Node.js
(globalThis as any).WebSocket = require('ws');

const CONNECTION_STRING = process.env.CONNECTION_STRING;

if (!CONNECTION_STRING) {
  console.error('ERROR: CONNECTION_STRING environment variable is required');
  console.error('Example: CONNECTION_STRING=ys://authkey@host tsx scripts/test-y-sweet-server.ts');
  process.exit(1);
}

interface TestResult {
  name: string;
  passed: boolean;
  duration_ms: number;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration_ms: Date.now() - start });
    console.log(`  PASS  ${name} (${Date.now() - start}ms)`);
  } catch (err: any) {
    results.push({ name, passed: false, duration_ms: Date.now() - start, error: err.message });
    console.log(`  FAIL  ${name} (${Date.now() - start}ms)`);
    console.log(`        ${err.message}`);
  }
}

async function main() {
  console.log('Y-Sweet Server Test');
  console.log('===================');
  console.log(`Server: ${CONNECTION_STRING!.replace(/ys:\/\/[^@]+@/, 'ys://***@')}`);
  console.log('');

  const manager = new DocumentManager(CONNECTION_STRING!);
  const testDocId = `test-${Date.now()}`;

  // Test 1: Create a document
  await runTest('Create document', async () => {
    const result = await manager.createDoc(testDocId);
    if (!result || !result.docId) {
      throw new Error('createDoc returned no docId');
    }
    if (result.docId !== testDocId) {
      throw new Error(`Expected docId "${testDocId}", got "${result.docId}"`);
    }
  });

  // Test 2: Get client token
  await runTest('Get client token', async () => {
    const token = await manager.getClientToken(testDocId);
    if (!token.url) throw new Error('Token missing url');
    if (!token.docId) throw new Error('Token missing docId');
    if (token.docId !== testDocId) {
      throw new Error(`Expected docId "${testDocId}", got "${token.docId}"`);
    }
  });

  // Test 3: Write and read via Yjs updates
  await runTest('Write and read document content', async () => {
    // Create a Y.Doc and add content
    const doc = new Y.Doc();
    const text = doc.getText('test');
    text.insert(0, 'Hello from Y-Sweet test!');

    // Upload the update to the server
    const update = Y.encodeStateAsUpdate(doc);
    await manager.updateDoc(testDocId, update);

    // Read it back
    const serverUpdate = await manager.getDocAsUpdate(testDocId);
    const readDoc = new Y.Doc();
    Y.applyUpdate(readDoc, serverUpdate);

    const content = readDoc.getText('test').toString();
    if (content !== 'Hello from Y-Sweet test!') {
      throw new Error(`Expected "Hello from Y-Sweet test!", got "${content}"`);
    }

    doc.destroy();
    readDoc.destroy();
  });

  // Test 4: Two-client sync via WebSocket provider
  await runTest('Two-client sync via provider', async () => {
    const syncDocId = `test-sync-${Date.now()}`;
    await manager.createDoc(syncDocId);

    const token = await manager.getClientToken(syncDocId);

    // Client A
    const docA = new Y.Doc();
    const providerA = createYjsProvider(docA, syncDocId, CONNECTION_STRING!, {
      initialClientToken: token as any,
    });

    // Wait for client A to sync
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Client A sync timeout')), 15000);
      providerA.on('sync', () => { clearTimeout(timeout); resolve(); });
    });

    // Client A writes
    docA.getText('shared').insert(0, 'Written by client A');

    // Small delay for server to process
    await new Promise(r => setTimeout(r, 1000));

    // Client B connects
    const tokenB = await manager.getClientToken(syncDocId);
    const docB = new Y.Doc();
    const providerB = createYjsProvider(docB, syncDocId, CONNECTION_STRING!, {
      initialClientToken: tokenB as any,
    });

    // Wait for client B to sync
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Client B sync timeout')), 15000);
      providerB.on('sync', () => { clearTimeout(timeout); resolve(); });
    });

    // Small delay for sync propagation
    await new Promise(r => setTimeout(r, 1000));

    // Verify client B has client A's content
    const contentB = docB.getText('shared').toString();
    if (!contentB.includes('Written by client A')) {
      throw new Error(`Client B missing A's content. Got: "${contentB}"`);
    }

    // Cleanup
    providerA.disconnect();
    providerB.disconnect();
    docA.destroy();
    docB.destroy();
  });

  // Test 5: Read-only token
  await runTest('Read-only token', async () => {
    const token = await manager.getClientToken(testDocId, { authorization: 'read-only' });
    if (!token.url) throw new Error('Read-only token missing url');
  });

  // Summary
  console.log('');
  console.log('Results');
  console.log('-------');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`${passed} passed, ${failed} failed, ${results.length} total`);

  if (failed > 0) {
    console.log('');
    console.log('Failures:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
