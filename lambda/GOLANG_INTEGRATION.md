# Go Integration in Lambda

## Overview

The Lambda function now supports invoking Go binaries for CPU-intensive operations. Communication between TypeScript and Go uses JSON-RPC style messages over stdin/stdout.

## Architecture

```
TypeScript Lambda Handler
    ↓ (spawn process)
Go Binary (/usr/local/bin/youtube-handler)
    ↓ (stdin: JSON request)
    ↓ (stdout: JSON response)
TypeScript processes result
```

## Type Safety

Types are shared between Go and TypeScript using JSON with snake_case naming:

**Go (types.go):**
```go
type VideoInfo struct {
    ID       string `json:"id"`
    Title    string `json:"title"`
    URL      string `json:"url"`
    Duration int64  `json:"duration"`
}
```

**TypeScript (go-client.ts):**
```typescript
export interface VideoInfo {
    id: string;
    title: string;
    url: string;
    duration: number;
}

export const VideoInfoSchema = z.object({
    id: z.string(),
    title: z.string(),
    url: z.string().url(),
    duration: z.number()
});
```

## Communication Protocol

### Request Format
```json
{
  "method": "youtube.playlist",
  "params": {
    "url": "https://www.youtube.com/playlist?list=..."
  }
}
```

### Response Format (Success)
```json
{
  "success": true,
  "result": {
    "videos": [
      {
        "id": "dQw4w9WgXcQ",
        "title": "Rick Astley - Never Gonna Give You Up",
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "duration": 213
      }
    ]
  }
}
```

### Response Format (Error)
```json
{
  "success": false,
  "error": "failed to get playlist: invalid URL"
}
```

## Proof of Concept: YouTube Playlist Enumeration

### Lambda Endpoint

**URL:** `POST /youtube/playlist`

**Request Body:**
```json
{
  "url": "https://www.youtube.com/playlist?list=PLAWoAwc-OTEXpBhr_e3ip49KdyZBw5a16"
}
```

**Response:**
```json
{
  "success": true,
  "videos": [
    {
      "id": "KDfWgcJRzMM",
      "title": "Perfect Pasta Sauce",
      "url": "https://www.youtube.com/watch?v=KDfWgcJRzMM",
      "duration": 620
    }
  ]
}
```

### Usage Example

```bash
curl -X POST https://your-api-gateway-url/youtube/playlist \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/playlist?list=PLAWoAwc-OTEXpBhr_e3ip49KdyZBw5a16"}' \
  | jq '.videos[] | "\(.title) (\(.duration)s)"'
```

## Local Testing

```bash
cd lambda/function

# Build and test with Docker
./test-youtube-local.sh
```

This builds the Docker image with the Go binary and tests the `/youtube/playlist` endpoint.

## Adding New Go Handlers

### 1. Define Types (go/types.go)

```go
type MyRequest struct {
    Param string `json:"param"`
}

type MyResponse struct {
    Result string `json:"result"`
}
```

### 2. Implement Handler (go/my-handler.go)

```go
func handleMyMethod(params json.RawMessage) (*MyResponse, error) {
    var req MyRequest
    if err := json.Unmarshal(params, &req); err != nil {
        return nil, err
    }

    // Your logic here

    return &MyResponse{Result: "..."}, nil
}
```

### 3. Register Method (go/main.go)

```go
func handleRequest(req Request) {
    switch req.Method {
    case "youtube.playlist":
        handlePlaylistRequest(req.Params)
    case "my.method":
        handleMyMethodRequest(req.Params)
    // ...
    }
}
```

### 4. Create TypeScript Client (src/my-client.ts)

```typescript
import { executeGo } from './go-executor.js';

export interface MyRequest {
    param: string;
}

export interface MyResponse {
    result: string;
}

export async function myMethod(param: string): Promise<string> {
    const response = await executeGo({
        method: 'my.method',
        params: { param }
    });

    if (!response.success) {
        throw new Error(response.error);
    }

    return (response.result as MyResponse).result;
}
```

### 5. Add Lambda Endpoint (src/index.ts)

```typescript
if (path === '/my/endpoint') {
    const result = await myMethod(body.param);
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ success: true, result })
    };
}
```

## File Structure

```
lambda/function/
├── go/                          # Go source code
│   ├── main.go                 # Binary entrypoint
│   ├── types.go                # Shared type definitions
│   ├── youtube.go              # YouTube handler
│   └── go.mod                  # Go dependencies
├── src/                         # TypeScript source
│   ├── index.ts                # Lambda handler
│   ├── go-executor.ts          # Go binary executor
│   ├── go-client.ts            # Type definitions & Zod schemas
│   └── youtube-client.ts       # YouTube client wrapper
├── Dockerfile                   # Multi-stage build (Go + Node)
└── test-youtube-local.sh       # Local testing script
```

## Docker Build

The Dockerfile uses multi-stage builds:

**Stage 1: Go Builder**
- Base: `golang:1.23-alpine`
- Builds Go binary as static executable
- Output: `/build/youtube-handler`

**Stage 2: Lambda Runtime**
- Base: `public.ecr.aws/lambda/nodejs:20`
- Copies Go binary from Stage 1
- Installs Node.js dependencies
- Compiles TypeScript

## Dependencies

**Go:**
- `github.com/kkdai/youtube/v2` - YouTube API client

**TypeScript:**
- `zod` - Runtime type validation

## Best Practices

1. **Always use snake_case for JSON fields** - Consistent with Go conventions and database schema
2. **Validate types with Zod** - Runtime safety in TypeScript
3. **Handle errors gracefully** - Return `{success: false, error: "..."}` format
4. **Set timeouts** - Go executor has 30-second default timeout
5. **Test locally first** - Use Docker before deploying to AWS
6. **Keep Go handlers stateless** - Each invocation should be independent

## Performance Considerations

- **Binary startup overhead**: ~10-50ms per invocation
- **JSON serialization**: Minimal overhead for most payloads
- **Process spawning**: Negligible in Lambda environment
- **Memory usage**: Go binary adds ~5-10MB to container size

For high-throughput scenarios, consider:
- Keeping Go process alive between invocations (stdin loop)
- Using Unix domain sockets instead of stdin/stdout
- Batch processing multiple requests

## Troubleshooting

### Go binary not found
**Error:** `Failed to spawn Go binary: ENOENT`

**Solution:** Ensure binary is copied in Dockerfile and marked executable:
```dockerfile
COPY --from=go-builder /build/youtube-handler /usr/local/bin/youtube-handler
RUN chmod +x /usr/local/bin/youtube-handler
```

### JSON parsing errors
**Error:** `Failed to parse Go binary output`

**Solution:** Check Go handler writes valid JSON to stdout. Use `fmt.Println(string(data))` not `fmt.Printf`.

### Timeout errors
**Error:** `Go binary execution timed out after 30000ms`

**Solution:** Increase timeout in `executeGo` call or optimize Go handler:
```typescript
await executeGo(request, { timeout: 60000 }); // 60 seconds
```

### Type mismatches
**Error:** `Invalid response format from Go binary`

**Solution:** Ensure JSON field names match between Go struct tags and TypeScript interfaces. Use snake_case consistently.

## Security

- **Input validation**: Always validate request parameters in Go handlers
- **Error messages**: Don't expose internal details in error responses
- **Resource limits**: Set appropriate timeouts and memory limits
- **Dependencies**: Keep Go modules updated for security patches
