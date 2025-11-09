# Lambda Streaming Testing Guide

This guide shows how to test AWS Lambda response streaming with the Vercel AI SDK locally using Docker.

## Overview

The streaming implementation uses:
- **`awslambda.streamifyResponse()`** - AWS Lambda's native streaming API
- **Vercel AI SDK** - `streamText()` and `useChat()` for LLM streaming
- **Docker Lambda Runtime** - Local testing environment identical to AWS

## Architecture

```
React UI (useChat) → Local Docker Lambda (port 9000) → OpenAI → Stream Response
```

The Lambda function exports two handlers:
1. **`handler`** (default) - Standard API Gateway handler for all content operations
2. **`streamingHandler`** - Streaming handler using `awslambda.streamifyResponse()` for chat

## Quick Start

### 1. Test Streaming Lambda Locally

```bash
cd lambda/function

# Build, run, test, and cleanup in one command
npm run test:streaming:full
```

This will:
1. Stop any existing streaming container
2. Build Docker image with streaming handler
3. Start container on port 9000
4. Wait 4 seconds for Lambda to initialize
5. Send test chat request
6. Stop container

You should see streaming response chunks in real-time.

### 2. Test with React UI

**Terminal 1 - Start Streaming Lambda:**
```bash
cd lambda/function
npm run test:streaming:build
npm run test:streaming:run
```

**Terminal 2 - Start Dev Server with Local Endpoint:**
```bash
# Set Lambda endpoint to local Docker
export LAMBDA_ENDPOINT="http://localhost:9000/2015-03-31/functions/function/invocations"

# Run dev server (rebuilds with local endpoint)
go run . serve --port 3002
```

**Browser:**
1. Open `http://localhost:3002`
2. Open AI Chat modal (uses `useAIChatV2` hook)
3. Send a message
4. Watch streaming response appear character-by-character

**Cleanup:**
```bash
npm run test:streaming:stop
```

## Manual Testing Steps

### Build Streaming Image

```bash
cd lambda/function
npm run test:streaming:build
```

This builds `lambda-test-streaming` using `Dockerfile.streaming` which:
- Uses `CMD [ "dist/index.streamingHandler" ]` instead of default handler
- Includes TypeScript types for `awslambda.streamifyResponse()`
- Bundles all dependencies with esbuild

### Run Streaming Container

```bash
npm run test:streaming:run
```

Required environment variables:
- `OPENAI_API_KEY` - OpenAI API key for GPT-4o-mini
- `SUPABASE_URL` - Supabase project URL (optional for chat)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (optional for chat)

The container:
- Exposes port 9000 (Lambda Runtime Interface Emulator)
- Runs in detached mode (`-d`)
- Named `lambda-streaming` for easy management

### Test with curl

```bash
npm run test:streaming:test
```

Or manually:
```bash
curl -XPOST http://localhost:9000/2015-03-31/functions/function/invocations \
  -H "Content-Type: application/json" \
  --data-binary @test-chat-v2-stream.json
```

Expected response (streaming):
```
0:"Hello! I'm doing well, thank you for asking"
0:". How can I assist you today?"
```

The `0:` prefix indicates streaming data chunks from Vercel AI SDK.

### Stop Container

```bash
npm run test:streaming:stop
```

## Test Payloads

### test-chat-v2-stream.json
Single turn conversation:
```json
{
  "action": "chat-v2-stream",
  "payload": {
    "messages": [
      { "role": "user", "content": "Hello! How are you?" }
    ]
  }
}
```

### test-chat-v2-multiturn.json
Multi-turn conversation:
```json
{
  "action": "chat-v2-stream",
  "payload": {
    "messages": [
      { "role": "user", "content": "What is 2 + 2?" },
      { "role": "assistant", "content": "2 + 2 equals 4." },
      { "role": "user", "content": "What about 3 + 3?" }
    ]
  }
}
```

## Vercel AI SDK Integration

### Backend (Lambda)

```typescript
// lambda/function/src/content-handlers.ts
export async function handleChatV2Stream(payload: ChatV2StreamPayload) {
  const result = streamText({
    model: openai('gpt-4o-mini', { apiKey: openaiApiKey }),
    messages: payload.messages,
    temperature: 0.7,
    maxTokens: 1000,
  });

  // Return stream (not Response) for awslambda.streamifyResponse
  return result.toDataStream();
}
```

### Frontend (React)

```typescript
// hooks/useAIChatV2.ts
import { useChat } from "@ai-sdk/react";

export function useAIChatV2() {
  const chat = useChat({
    api: BUILD_TIME_LAMBDA_ENDPOINT, // Injected at build time
    body: {
      action: "chat-v2-stream",
    },
    streamProtocol: "data",
  });

  return chat;
}
```

The `useChat` hook automatically:
- Manages message state
- Handles input state
- Streams responses incrementally
- Provides loading states

## Streaming Handler Implementation

```typescript
// lambda/function/src/index.ts
export const streamingHandler = awslambda.streamifyResponse(
  async (event, responseStream, _context) => {
    // Parse request (supports multiple formats)
    const request = parseRequest(event);

    // Get stream from Vercel AI SDK
    const stream = await handleChatV2Stream(request.payload);

    // Stream chunks to response
    for await (const chunk of stream) {
      responseStream.write(chunk);
    }

    responseStream.end();
  }
);
```

Key points:
- **`awslambda.streamifyResponse()`** - Wraps handler for streaming support
- **`responseStream.write()`** - Writes chunks as they're generated
- **`responseStream.end()`** - Closes stream when complete
- **No buffering** - Chunks sent immediately (< 500ms first token)

## Troubleshooting

### Handler fails to load (502 error)

**Cause**: TypeScript types not found or build failed

**Solution**:
```bash
# Rebuild with types directory
npm run test:streaming:build
```

Ensure `Dockerfile.streaming` copies `types/` directory:
```dockerfile
COPY types/ ./types/
```

### Stream returns error instead of chunks

**Cause**: Missing `OPENAI_API_KEY` environment variable

**Solution**:
```bash
export OPENAI_API_KEY="your-key-here"
npm run test:streaming:run
```

### React UI shows buffered response (not streaming)

**Cause**: Using wrong endpoint or handler

**Solution**:
1. Ensure `LAMBDA_ENDPOINT` points to local Docker
2. Rebuild dev server after setting env var
3. Check browser network tab for streaming response

### "Cannot find module 'aws-lambda-runtime.d.ts'"

**Cause**: TypeScript can't find streaming types

**Solution**: Types are in `lambda/function/types/aws-lambda-runtime.d.ts`

Ensure `tsconfig.json` includes:
```json
{
  "compilerOptions": {
    "typeRoots": ["./types", "./node_modules/@types"]
  }
}
```

### Docker container won't start

**Cause**: Port 9000 already in use

**Solution**:
```bash
# Find process using port 9000
lsof -ti:9000 | xargs kill -9

# Or use different port
docker run -p 9001:8080 lambda-test-streaming
```

## Performance Expectations

With streaming enabled:
- **First token**: < 500ms (usually 200-300ms)
- **Streaming rate**: 20-50 tokens/second
- **Total response**: Appears progressively, not all at once
- **Memory**: Constant (not buffered)

Without streaming (buffered):
- **First token**: 5-30 seconds (entire response generation)
- **Streaming rate**: N/A (all or nothing)
- **Total response**: Appears instantly when complete
- **Memory**: Grows with response size

## Production Deployment

For production streaming with AWS Lambda:

1. **Use Lambda Function URLs** (not API Gateway):
   ```typescript
   // Pulumi example
   const functionUrl = new aws.lambda.FunctionUrl("streaming-url", {
     functionName: lambdaFunction.name,
     authorizationType: "NONE",
     invokeMode: "RESPONSE_STREAM", // Critical!
   });
   ```

2. **Update infrastructure** to use streaming handler:
   ```typescript
   const lambdaFunction = new aws.lambda.Function("streaming-lambda", {
     // ...
     handler: "dist/index.streamingHandler", // Not "dist/index.handler"
   });
   ```

3. **Configure CORS** for streaming:
   ```typescript
   cors: {
     allowOrigins: ["*"],
     allowMethods: ["POST"],
     allowHeaders: ["Content-Type", "Cache-Control"],
     maxAge: "86400",
   }
   ```

**Note**: API Gateway does NOT support response streaming. You must use Lambda Function URLs.

## Resources

- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
- [AWS Lambda Streaming](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html)
- [Lambda Function URLs](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html)
- [OpenAI Models](https://platform.openai.com/docs/models)
