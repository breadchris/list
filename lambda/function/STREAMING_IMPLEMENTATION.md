# Lambda Streaming Implementation Summary

## What Was Implemented

This implementation adds true AWS Lambda response streaming support using `awslambda.streamifyResponse()` for the Vercel AI SDK chat integration.

### Key Components

#### 1. TypeScript Types (`types/aws-lambda-runtime.d.ts`)
- Global type definitions for `awslambda.streamifyResponse()`
- `ResponseStream` interface with `write()` and `end()` methods
- Ensures TypeScript recognizes AWS Lambda streaming runtime

#### 2. Streaming Handler (`src/index.ts`)
- New `streamingHandler` export using `awslambda.streamifyResponse()`
- Wraps the Vercel AI SDK stream and writes chunks directly to response
- Supports multiple request formats:
  - Direct invocation: `{ action, payload }`
  - API Gateway: `{ body: { action, payload } }`
  - Vercel useChat: `{ id, messages }`

#### 3. Chat Handler Update (`src/content-handlers.ts`)
- Changed `handleChatV2Stream()` to return `result.toDataStream()`
- Returns async iterable stream instead of Response object
- Compatible with `awslambda.streamifyResponse()` iteration

#### 4. Docker Configuration
- **`Dockerfile.streaming`** - Specialized build for streaming handler
- Uses `CMD [ "dist/index.streamingHandler" ]`
- Includes types directory in build

#### 5. Testing Scripts (`package.json`)
- `test:streaming:build` - Build streaming Docker image
- `test:streaming:run` - Run streaming container on port 9000
- `test:streaming:stop` - Stop streaming container
- `test:streaming:test` - Test with curl
- `test:streaming:full` - Complete build-test-cleanup cycle

#### 6. React Hook Update (`hooks/useAIChatV2.ts`)
- Added `streamProtocol: "data"` for Vercel AI SDK
- Documentation for local Docker Lambda testing
- Build-time endpoint configuration via `LAMBDA_ENDPOINT` env var

#### 7. Documentation
- **`STREAMING_TESTING.md`** - Comprehensive testing guide
- **`STREAMING_IMPLEMENTATION.md`** - This file

## Architecture

### Before (Buffered Response)
```
React → Lambda → OpenAI → Full Response → Lambda → React
                   [Wait 5-30 seconds]
```

### After (True Streaming)
```
React → Lambda → OpenAI → Chunk 1 → React
                        → Chunk 2 → React  [< 500ms]
                        → Chunk 3 → React
                        → ...
```

### Handler Structure

```typescript
// Standard handler (API Gateway compatible)
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // Handles all content operations
  // Returns JSON responses
  // Does NOT support streaming
};

// Streaming handler (Lambda Function URLs)
export const streamingHandler = awslambda.streamifyResponse(
  async (event, responseStream, context) => {
    // Handles chat-v2-stream only
    // Streams chunks directly
    // Uses awslambda.streamifyResponse()

    const stream = await handleChatV2Stream(payload);

    for await (const chunk of stream) {
      responseStream.write(chunk);  // Real-time streaming
    }

    responseStream.end();
  }
);
```

## How to Test Locally

### Quick Test (Verify Infrastructure)

```bash
cd lambda/function
npm run test:streaming:full
```

Expected output (without OPENAI_API_KEY):
```json
{"success":false,"error":"OpenAI API key not configured"}
```

This confirms:
- ✅ Docker build succeeds
- ✅ TypeScript compiles
- ✅ Lambda handler loads
- ✅ Streaming handler is accessible
- ✅ Request parsing works

### Full Test (With OpenAI)

```bash
cd lambda/function

# Set OpenAI API key
export OPENAI_API_KEY="your-openai-api-key"

# Run full test
npm run test:streaming:full
```

Expected output:
```
0:"Hello! I'm doing well"
0:", thank you for asking"
0:". How can I assist you today?"
```

The `0:` prefix indicates streaming data chunks from Vercel AI SDK.

### Test with React UI

**Terminal 1 - Lambda:**
```bash
cd lambda/function
export OPENAI_API_KEY="your-key"
npm run test:streaming:build
npm run test:streaming:run
```

**Terminal 2 - Dev Server:**
```bash
cd /path/to/project
export LAMBDA_ENDPOINT="http://localhost:9000/2015-03-31/functions/function/invocations"
go run . serve --port 3002
```

**Browser:**
1. Open `http://localhost:3002`
2. Open AI Chat modal
3. Type a message
4. Watch streaming response appear character-by-character

## Implementation Details

### Vercel AI SDK Integration

The Vercel AI SDK provides two key functions:

1. **`streamText()`** (backend) - Generates streaming LLM responses
   ```typescript
   const result = streamText({
     model: openai('gpt-4o-mini'),
     messages: payload.messages,
   });
   ```

2. **`useChat()`** (frontend) - Consumes streaming responses
   ```typescript
   const { messages, input, handleSubmit } = useChat({
     api: "/lambda-endpoint",
     body: { action: "chat-v2-stream" },
     streamProtocol: "data",
   });
   ```

### Stream Format

Vercel AI SDK uses a data stream format:
```
0:"Hello"
0:" world"
0:"!"
```

Each line:
- Starts with `0:` (stream ID)
- Followed by JSON-encoded string
- Newline-delimited

The `useChat` hook automatically parses this format.

### Why `awslambda.streamifyResponse()`?

Standard Lambda handlers return complete responses:
```typescript
return {
  statusCode: 200,
  body: JSON.stringify(response)  // Must be complete
};
```

`awslambda.streamifyResponse()` enables chunked responses:
```typescript
awslambda.streamifyResponse(async (event, responseStream) => {
  for await (const chunk of stream) {
    responseStream.write(chunk);  // Send immediately
  }
  responseStream.end();
});
```

Benefits:
- **First token < 500ms** - No waiting for full response
- **Constant memory** - No buffering
- **Better UX** - Progressive display

## Production Deployment

### Requirements

1. **Lambda Function URLs** - API Gateway doesn't support streaming
   ```typescript
   const functionUrl = new aws.lambda.FunctionUrl("chat-streaming", {
     functionName: lambdaFunction.name,
     authorizationType: "NONE",
     invokeMode: "RESPONSE_STREAM",  // Critical!
   });
   ```

2. **Streaming Handler** - Use `streamingHandler` export
   ```typescript
   const lambdaFunction = new aws.lambda.Function("chat", {
     handler: "dist/index.streamingHandler",  // Not "handler"
     // ...
   });
   ```

3. **CORS Configuration** - Allow streaming headers
   ```typescript
   cors: {
     allowHeaders: ["Content-Type", "Cache-Control"],
     maxAge: "86400",
   }
   ```

### Deployment Steps

1. Build Lambda with streaming handler:
   ```bash
   cd lambda/function
   docker build -t lambda-streaming -f Dockerfile.streaming .
   ```

2. Tag and push to ECR:
   ```bash
   docker tag lambda-streaming:latest <ecr-url>/lambda-streaming:latest
   docker push <ecr-url>/lambda-streaming:latest
   ```

3. Update Pulumi infrastructure:
   ```typescript
   const lambdaFunction = new aws.lambda.Function("chat-streaming", {
     imageUri: pulumi.interpolate`${ecrRepo.repositoryUrl}:latest`,
     handler: "dist/index.streamingHandler",
     // ...
   });

   const functionUrl = new aws.lambda.FunctionUrl("chat-url", {
     functionName: lambdaFunction.name,
     invokeMode: "RESPONSE_STREAM",
   });
   ```

4. Update frontend endpoint:
   ```bash
   export LAMBDA_ENDPOINT="https://your-function-url.lambda-url.region.on.aws/"
   go run . serve
   ```

## Performance Comparison

### Buffered (Before)
- First token: 5-30 seconds
- Total time: 5-30 seconds
- Memory: O(response_size)
- User experience: "Is it broken?"

### Streaming (After)
- First token: 200-500ms
- Total time: Same as buffered
- Memory: O(chunk_size) - constant
- User experience: "It's thinking!"

## Troubleshooting

### "OpenAI API key not configured"
**Solution**: Export `OPENAI_API_KEY` before running tests
```bash
export OPENAI_API_KEY="sk-..."
```

### Handler fails to load (502)
**Solution**: Rebuild with types directory
```bash
npm run test:streaming:build
```

### Stream returns buffered response
**Solution**: Ensure using streaming handler and Function URL (not API Gateway)

### TypeScript errors about `awslambda`
**Solution**: Types are in `types/aws-lambda-runtime.d.ts`, ensure it's included in build

## Files Modified

1. `lambda/function/types/aws-lambda-runtime.d.ts` - New
2. `lambda/function/src/index.ts` - Added `streamingHandler`
3. `lambda/function/src/content-handlers.ts` - Changed to return stream
4. `lambda/function/Dockerfile` - Added types directory
5. `lambda/function/Dockerfile.streaming` - New
6. `lambda/function/package.json` - Added streaming test scripts
7. `hooks/useAIChatV2.ts` - Added `streamProtocol`
8. `lambda/function/STREAMING_TESTING.md` - New
9. `lambda/function/STREAMING_IMPLEMENTATION.md` - New

## Next Steps

To use streaming in production:

1. **Deploy streaming Lambda** with Function URL
2. **Update frontend** to use streaming endpoint
3. **Monitor performance** - CloudWatch metrics for streaming
4. **Consider fallback** - Non-streaming for older clients

## Resources

- [AWS Lambda Streaming Docs](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html)
- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
- [Lambda Function URLs](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html)
