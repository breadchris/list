# Claude Code Lambda

AWS Lambda implementation for Claude Code execution with session management via S3.

## Architecture

- **AWS Lambda** (Node.js 20.x) - Runs Claude Code SDK with filesystem support
- **S3 Bucket** - Stores compressed session files as .zip archives
- **API Gateway HTTP API** - Exposes `/claude-code` POST endpoint
- **Secrets Manager** - Stores sensitive API keys
- **Pulumi** - Infrastructure as Code for deployment

## Features

- ✅ Claude Code SDK execution in Node.js environment
- ✅ Session persistence across requests via S3
- ✅ CORS-enabled API endpoint
- ✅ Comprehensive Playwright test suite
- ✅ 5-minute timeout for long-running operations
- ✅ 2GB memory allocation for Claude SDK

## Prerequisites

- Node.js 20.x or later
- AWS CLI configured with credentials
- Pulumi CLI installed
- API keys: Anthropic API key, Supabase service role key

## Installation

### 1. Install Dependencies

```bash
# Install Lambda function dependencies
cd lambda/function
npm install

# Install Pulumi dependencies
cd ..
npm install
```

### 2. Build Lambda Code

```bash
cd lambda/function
npm run build
```

This compiles TypeScript to `/lambda/function/dist` which Pulumi will package.

### 3. Configure Pulumi Secrets

```bash
cd lambda

# Initialize Pulumi stack (first time only)
pulumi stack init dev

# Set secrets
pulumi config set --secret anthropic_api_key YOUR_ANTHROPIC_API_KEY
pulumi config set --secret supabase_service_role_key YOUR_SUPABASE_KEY

# Verify configuration
pulumi config
```

### 4. Deploy Infrastructure

```bash
cd lambda
pulumi up
```

Review the preview and confirm deployment. This creates:
- S3 bucket: `claude-code-sessions`
- Lambda function: `claude-code-lambda`
- API Gateway: HTTP API with `/claude-code` route
- IAM roles and policies

### 5. Get API Endpoint

```bash
pulumi stack output apiUrl
```

Copy this URL for testing.

## Testing

### Run Tests

```bash
cd lambda

# Set the Lambda API URL from Pulumi output
export LAMBDA_API_URL=$(pulumi stack output apiUrl)

# Run tests
npm test
```

### Test Results

The test suite includes:
- Session creation tests (3)
- Session continuation tests (3)
- Error handling tests (5)
- Response format validation (3)
- Integration scenarios (3)
- Performance tests (2)

**Expected**: All 19 tests should pass once deployed.

## API Usage

### Endpoint

```
POST https://{api-id}.execute-api.us-east-1.amazonaws.com/claude-code
```

### Request Format

```json
{
  "prompt": "What is 2 + 2?",
  "session_id": "session-abc123" // Optional, for continuing sessions
}
```

### Response Format

**Success:**
```json
{
  "success": true,
  "session_id": "session-mg8r78xo-98u3j9gjrl",
  "messages": [...],
  "s3_url": "s3://claude-code-sessions/session-mg8r78xo-98u3j9gjrl.zip"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message",
  "session_id": "session-abc123" // If applicable
}
```

## Session Management

Sessions are stored as compressed ZIP files in S3:
- **Key format**: `{session_id}.zip`
- **Compression**: DEFLATE level 6
- **Metadata**: Created timestamp, file count
- **Versioning**: Enabled on bucket

To continue a session, include the `session_id` from a previous response.

## Environment Variables

Lambda automatically receives:
- `S3_BUCKET_NAME` - Claude Code session bucket
- `ANTHROPIC_API_KEY` - From Pulumi secrets
- `SUPABASE_SERVICE_ROLE_KEY` - From Pulumi secrets
- `SUPABASE_URL` - From Pulumi config
- `AWS_REGION` - Auto-set by Lambda

## Updating the Lambda

After code changes:

```bash
cd lambda/function
npm run build

cd ..
pulumi up
```

Pulumi detects changes and updates only the Lambda function.

## Cleanup

To destroy all infrastructure:

```bash
cd lambda
pulumi destroy
```

**Warning**: This deletes the S3 bucket and all session data.

## Comparison to Cloudflare Worker

| Feature | Cloudflare Worker | AWS Lambda |
|---------|------------------|------------|
| Runtime | V8 isolates | Node.js 20.x |
| Filesystem | ❌ No | ✅ Yes (/tmp) |
| Timeout | 30s | 300s (5 min) |
| Memory | 128MB | 2048MB |
| Storage | R2 | S3 |
| Claude SDK | ❌ Incompatible | ✅ Compatible |

## Troubleshooting

### Lambda timeout
- Increase timeout in `infra/index.ts` (max 15 minutes)
- Check CloudWatch Logs for execution details

### S3 permissions
- Verify IAM role has PutObject/GetObject permissions
- Check bucket policy allows Lambda access

### API Gateway errors
- Verify route is configured for POST method
- Check CORS settings if browser requests fail

## License

Same as parent project.
