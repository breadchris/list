# Browser Testing with Local Lambda

## Problem

The AWS Lambda Runtime Interface Emulator (RIE) used in Docker doesn't support HTTP methods like OPTIONS. It only accepts JSON payloads via direct invocations. This means browsers cannot make CORS requests to the local Lambda.

## Solution

Use the **HTTP CORS Proxy** (`lambda-proxy.js`) to bridge between browser HTTP requests and Lambda invocations.

```
Browser (localhost:3002)
    ↓ HTTP with CORS
Proxy Server (localhost:9001)
    ↓ Lambda Invocation
Lambda Docker (localhost:9000)
    ↓ OpenAI Streaming
Response back to browser
```

## Quick Start

### Terminal 1 - Lambda Container

```bash
cd lambda/function

# Build Docker image
npm run test:docker:build

# Start Lambda container
export OPENAI_API_KEY="your-key"
docker run --rm -d -p 9000:8080 --name lambda-browser \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  lambda-test

# Verify Lambda is running
curl -XPOST http://localhost:9000/2015-03-31/functions/function/invocations \
  -H 'Content-Type: application/json' \
  --data '{"action":"chat-v2-stream","payload":{"messages":[{"role":"user","content":"test"}]}}'
```

### Terminal 2 - CORS Proxy

```bash
cd lambda/function

# Start proxy (forwards browser requests to Lambda)
npm run proxy

# You should see:
# ╔════════════════════════════════════════════════════════════════╗
# ║  Lambda CORS Proxy Server                                      ║
# ║  Proxy Port:    9001                                            ║
# ║  Browser should connect to: http://localhost:9001              ║
# ╚════════════════════════════════════════════════════════════════╝
```

### Terminal 3 - Dev Server

```bash
# Set Lambda endpoint to proxy URL
export LAMBDA_ENDPOINT="http://localhost:9001"

# Start dev server
go run . serve --port 3002
```

### Browser

1. Open `http://localhost:3002`
2. Open AI Chat modal (uses `useAIChatV2` hook)
3. Send a message
4. Response will be **buffered** (not streaming in local mode)

## How It Works

### Proxy Server (`lambda-proxy.js`)

The proxy:
1. **OPTIONS requests** → Returns 204 with CORS headers immediately
2. **POST requests** → Forwards JSON to Lambda, returns response with CORS headers

```javascript
// OPTIONS handling
if (req.method === 'OPTIONS') {
  res.writeHead(204, CORS_HEADERS);
  res.end();
  return;
}

// POST handling
const lambdaResponse = await invokeLambda(requestBody);
res.writeHead(lambdaResponse.statusCode, {
  ...CORS_HEADERS,
  ...lambdaResponse.headers
});
res.end(lambdaResponse.body);
```

### Lambda Handler

The standard handler (`dist/index.handler`):
- Handles `chat-v2-stream` action
- Returns **buffered response** (not true streaming)
- Includes CORS headers in response

```typescript
case 'chat-v2-stream':
  const streamResponse = await handleChatV2StreamResponse(payload);
  const streamText = await streamResponse.text(); // Buffers entire response
  return {
    statusCode: 200,
    headers: { ...corsHeaders },
    body: streamText
  };
```

## Limitations of Local Testing

### ⚠️ No True Streaming

Local Docker testing **buffers the entire response** before returning it. You won't see character-by-character streaming like in production.

**Why?**
- Lambda RIE doesn't support `awslambda.streamifyResponse()`
- Standard handler must read entire stream into memory
- Browser receives complete response at once

**For true streaming**, deploy to AWS with Lambda Function URLs.

### Local vs Production

| Feature | Local (Docker + Proxy) | Production (Lambda Function URL) |
|---------|------------------------|----------------------------------|
| CORS Support | ✅ Via proxy | ✅ Native |
| OPTIONS Preflight | ✅ Proxy handles | ✅ Native |
| True Streaming | ❌ Buffered | ✅ Real-time chunks |
| First Token Latency | N/A (buffered) | < 500ms |
| Memory Usage | High (buffers full response) | Constant (streaming) |

## Production Deployment

For production with true streaming:

### 1. Use Lambda Function URLs

```typescript
// Pulumi infrastructure
const functionUrl = new aws.lambda.FunctionUrl("chat-url", {
  functionName: lambdaFunction.name,
  authorizationType: "NONE",
  invokeMode: "RESPONSE_STREAM", // Critical for streaming!
  cors: {
    allowOrigins: ["*"],
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  },
});
```

### 2. Use Streaming Handler

Update Dockerfile to use streaming handler:

```dockerfile
# Use streaming handler for production
CMD [ "dist/index.streamingHandler" ]
```

Or build with `Dockerfile.streaming`:
```bash
docker build -t lambda-streaming -f Dockerfile.streaming .
```

### 3. Update Frontend

```typescript
export function useAIChatV2() {
  const chat = useChat({
    api: "https://your-function-url.lambda-url.region.on.aws/",
    body: {
      action: "chat-v2-stream",
    },
    streamProtocol: "data",
  });
  return chat;
}
```

## Troubleshooting

### Proxy won't start - "Port already in use"

```bash
# Find process using port 9001
lsof -ti:9001 | xargs kill -9

# Or use a different port
node lambda-proxy.js 9002 http://localhost:9000/2015-03-31/functions/function/invocations
```

### Browser CORS error

Check that:
1. Proxy is running on port 9001
2. `LAMBDA_ENDPOINT` is set to `http://localhost:9001`
3. Dev server was restarted after setting env var

```bash
# Verify endpoint
echo $LAMBDA_ENDPOINT  # Should be http://localhost:9001

# Restart dev server
go run . serve --port 3002
```

### Lambda returns "OpenAI API key not configured"

The container doesn't have the API key:

```bash
# Stop and restart with API key
docker stop lambda-browser
export OPENAI_API_KEY="your-actual-key"
docker run --rm -d -p 9000:8080 --name lambda-browser \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  lambda-test
```

### Response is empty or malformed

Check proxy logs - they show the Lambda response:

```bash
# Proxy logs show:
[PROXY] Lambda statusCode: 200
[PROXY] Request: { action: "chat-v2-stream", ... }
```

If `statusCode` is 500, check Lambda logs:
```bash
docker logs lambda-browser
```

## Scripts Reference

```bash
# Build Lambda Docker image
npm run test:docker:build

# Start Lambda (standard handler)
npm run test:docker:run

# Start CORS proxy
npm run proxy

# Test with curl (bypasses proxy)
npm run test:chat-v2

# Full test (build + run + test + cleanup)
npm run test:docker:full
```

## Files

- `lambda-proxy.js` - HTTP CORS proxy server
- `Dockerfile` - Standard handler (buffers responses)
- `Dockerfile.streaming` - Streaming handler (for production)
- `src/index.ts` - Main handler with chat-v2-stream support
- `src/content-handlers.ts` - Chat streaming logic

## Next Steps

1. **Local testing** - Use this setup for development
2. **Production deployment** - Use Lambda Function URLs with streaming handler
3. **Performance testing** - Deploy to AWS to test true streaming
4. **Monitoring** - Add CloudWatch metrics for streaming latency
