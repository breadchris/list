#!/usr/bin/env node
/**
 * Local test script for handleChatV2Stream function
 *
 * Usage:
 *   export OPENAI_API_KEY="your-key-here"
 *   npx tsx test-chat-local.ts
 *
 * Or use the npm script:
 *   npm run test:chat:local
 */

import { handleChatV2StreamResponse } from "./src/content-handlers.js";
import type { ChatV2StreamPayload } from "./src/types.js";

async function testChatV2Stream() {
  console.log("🧪 Testing handleChatV2Stream locally...\n");

  // Check if API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Error: OPENAI_API_KEY environment variable not set");
    console.error("Please set it with: export OPENAI_API_KEY='your-key-here'");
    process.exit(1);
  }

  // Create test payload
  const payload: ChatV2StreamPayload = {
    messages: [
      { role: "user", content: "What is the capital of France?" }
    ]
  };

  console.log("📤 Request:");
  console.log(JSON.stringify(payload, null, 2));
  console.log("\n📥 Response:\n");

  try {
    // Call the handler
    const response = await handleChatV2StreamResponse(payload);

    // Check if response is valid
    if (!response || !response.body) {
      throw new Error("Invalid response: no body");
    }

    // Read the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;
      process.stdout.write(chunk); // Stream output in real-time
    }

    console.log("\n\n✅ Test completed successfully!");

    // Try to parse and display structured data
    try {
      const lines = fullResponse.split("\n").filter(line => line.trim());
      console.log("\n📊 Parsed responses:");

      for (const line of lines) {
        if (line.startsWith("0:")) {
          // Data stream format from Vercel AI SDK
          const jsonStr = line.substring(2);
          const parsed = JSON.parse(jsonStr);
          console.log(JSON.stringify(parsed, null, 2));
        }
      }
    } catch (e) {
      console.log("\n⚠️  Could not parse structured data (this is normal for streaming)");
    }

  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testChatV2Stream();
