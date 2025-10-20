# AWS Lambda Development Guidelines

**CRITICAL**: Always test locally with Docker before deploying to AWS

## Lambda Endpoint Architecture

**CRITICAL**: The content Lambda has ONE endpoint only: `/content`

**Design Principles:**
- **Single endpoint pattern** - All content processing operations use POST `/content`
- **Action-based routing** - Functionality is added via the `action` field in the request payload
- **NEVER add new endpoints** - Do not create `/content/seo`, `/content/libgen`, etc.
- **Payload-driven design** - All variations handled through the payload structure

**Request Format:**
```json
{
  "action": "libgen-search",
  "payload": {
    "selectedContent": [...],
    "searchType": "author",
    "topics": ["libgen"],
    "maxResults": 10
  }
}
```

**Why Single Endpoint?**
- Simpler API Gateway configuration
- Consistent routing pattern
- Easier to add features (just add new action type)
- No need to update infrastructure for new functionality
- Clear separation of concerns (routing vs. processing)

**Adding New Functionality:**
1. Add new action type to `ContentRequest` type in `types.ts`
2. Add handler function in `content-handlers.ts`
3. Add case to switch statement in `handleContentRequest()`
4. NO infrastructure changes needed

**Examples of Actions:**
- `seo-extract` - Extract SEO metadata from URLs
- `libgen-search` - Search Library Genesis for books
- `tmdb-search` - Search The Movie Database
- `llm-generate` - Generate content with LLM
- `markdown-extract` - Extract markdown from URLs
- `youtube-playlist-extract` - Extract YouTube playlist videos

## Local-First Development Workflow

The Lambda function for Claude Code execution should always be tested locally before deployment. This provides immediate feedback and avoids slow CloudWatch log debugging.

**Development Loop:**
1. Make code changes in `lambda/function/src/`
2. Test locally with Docker (see below)
3. Iterate until working
4. Deploy to AWS with Pulumi
5. Verify with production curl test

## Local Docker Testing

**CRITICAL**: All code changes MUST pass local Docker tests before deploying to Lambda

**Prerequisites:**
- Docker installed and running
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables set

**Mandatory Testing Workflow:**
```bash
cd lambda/function

# Run full test (REQUIRED before deployment)
npm run test:docker:full
```

This command:
1. Kills any existing test containers on port 9000
2. Builds the Docker image with multi-stage TypeScript bundling
3. Starts the Lambda Runtime Interface Emulator
4. Invokes the handler with test payload
5. Validates handler loaded successfully (200 or 400 response, NOT 502)
6. Stops the container
7. **Fails if handler cannot load**

**CommonJS Bundling:**
The build process creates `dist/index.cjs` (not `.js`) to ensure AWS Lambda Node.js 20 runtime treats the bundle as CommonJS, avoiding "Dynamic require" errors.

**Build Configuration:**
- Output: `dist/index.cjs` (CommonJS extension)
- Format: `--format=cjs` (esbuild)
- Handler: `dist/index.handler` (Lambda CMD)

**Manual Testing (if needed):**
```bash
# 1. Build Docker image
npm run test:docker:build

# 2. Run Lambda Runtime Interface Emulator
npm run test:docker:run

# 3. Test with curl (in another terminal)
curl -XPOST http://localhost:9000/2015-03-31/functions/function/invocations \
  -H "Content-Type: application/json" \
  --data-binary @test-payload-simple.json
```

**Test Payload:**
```json
{
  "action": "youtube-subtitle-extract",
  "payload": {
    "selectedContent": [{
      "id": "test-123",
      "type": "text",
      "data": "https://www.youtube.com/watch?v=SOUvvDTBdic",
      "metadata": {
        "youtube_video_id": "SOUvvDTBdic"
      },
      "group_id": "test-group",
      "user_id": "test-user"
    }]
  },
  "sync": true
}
```

## Debugging Output in Responses

The Lambda function returns detailed debugging information in the HTTP response:

```json
{
  "success": false,
  "session_id": "session-xxx",
  "error": "Claude Code process exited with code 1",
  "stdout": "...captured process stdout...",
  "stderr": "...captured process stderr...",
  "exitCode": 1,
  "messages": []
}
```

**Key fields for debugging:**
- `stdout` - All stdout from Claude Code CLI process
- `stderr` - All stderr from Claude Code CLI process
- `exitCode` - Process exit code (0 = success, 1 = error)
- `error` - High-level error message
- `messages` - SDK messages (empty if process failed early)

## Common Issues and Solutions

**Issue: "Dynamic require of 'buffer' is not supported" (502 error)**
- **Cause**: Lambda loading bundle as ESM instead of CommonJS due to `.js` extension ambiguity
- **Solution**: Ensure esbuild outputs to `dist/index.cjs` (not `.js`) for unambiguous CommonJS
- **Prevention**: Always run `npm run test:docker:full` before deploying to catch this locally

**Issue: Console.log not appearing in CloudWatch**
- **Cause**: Node.js Lambda buffers stdout/stderr
- **Solution**: Use `process.stderr.write()` for immediate output, or rely on response debugging fields

**Issue: Docker build fails with missing files**
- **Cause**: .dockerignore excluding necessary files
- **Solution**: Check .dockerignore doesn't exclude tsconfig.json or source files

**Issue: Lambda works locally but fails in AWS**
- **Cause**: Environment variables not set in Pulumi config
- **Solution**: Check `lambda/index.ts` environment variable configuration

**Issue: "Claude Code process exited with code 1"**
- **Debugging**: Check `stdout` and `stderr` fields in response
- **Common causes**: Missing ANTHROPIC_API_KEY, CLI not found, invalid API key

**Issue: Port 9000 already in use**
- **Cause**: Previous Docker container still running from failed test
- **Solution**: Run `npm run test:docker:cleanup` or use `npm run test:docker:full` (includes cleanup)

## Deployment After Local Testing

Once local tests pass:

```bash
cd lambda

# Deploy with Pulumi
export PULUMI_CONFIG_PASSPHRASE=""
npm run up -- --yes

# Test production endpoint
curl -X POST "https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/claude-code" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2 + 2?"}' | jq '.'
```

## Lambda Function Architecture

**Structure:**
- `lambda/function/src/index.ts` - API Gateway handler with CORS
- `lambda/function/src/claude-executor.ts` - Claude Code SDK execution with output capture
- `lambda/function/src/session-manager.ts` - S3 session file management
- `lambda/function/Dockerfile` - Container image with Claude CLI installed
- `lambda/index.ts` - Pulumi infrastructure (ECR, Lambda, API Gateway, IAM)

**Key Components:**
- Docker-based Lambda (not ZIP deployment)
- Claude Code CLI installed globally via npm
- Process output captured via SDK hooks
- All output returned in HTTP response for debugging
- S3 for session file storage (optional)

## Best Practices

1. **Always test locally first** - Faster feedback loop than AWS deployment
2. **Use Docker build cache** - Rebuilds are fast when only source changes
3. **Check exit codes** - Process exit code 0 means success
4. **Read stdout/stderr** - Contains actual error messages from CLI
5. **Verify API key** - Most failures are due to missing/invalid ANTHROPIC_API_KEY
6. **Test incrementally** - Start with simple prompts, add complexity gradually
