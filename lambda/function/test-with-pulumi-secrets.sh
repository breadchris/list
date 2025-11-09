#!/bin/bash
# Test Claude Code with secrets loaded from Pulumi

set -e

cd "$(dirname "$0")"

echo "===================="
echo "Claude Code Testing with Pulumi Secrets"
echo "===================="
echo ""

# Load secrets from Pulumi
echo "Loading secrets from Pulumi..."
cd ..
export PULUMI_CONFIG_PASSPHRASE=""

export ANTHROPIC_API_KEY=$(pulumi config get anthropic_api_key)
export SUPABASE_SERVICE_ROLE_KEY=$(pulumi config get supabase_service_role_key)
export SUPABASE_URL=$(pulumi config get supabase_url)
export OPENAI_API_KEY=$(pulumi config get openai_api_key)
export CLOUDFLARE_API_KEY=$(pulumi config get cloudflare_api_key)
export CLOUDFLARE_ACCOUNT_ID=$(pulumi config get cloudflare_account_id)
export TMDB_API_KEY=$(pulumi config get tmdb_api_key)
export DEEPGRAM_API_KEY=$(pulumi config get deepgram_api_key)

echo "✓ Secrets loaded"
echo ""

cd function

# Build Docker image
echo "Building Docker image..."
npm run test:docker:build
echo "✓ Docker image built"
echo ""

# Start Lambda container
echo "Starting Lambda container..."
docker run --rm -d -p 9000:8080 --name lambda-test-pulumi \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e SUPABASE_URL=$SUPABASE_URL \
  -e SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e CLOUDFLARE_API_KEY=$CLOUDFLARE_API_KEY \
  -e CLOUDFLARE_ACCOUNT_ID=$CLOUDFLARE_ACCOUNT_ID \
  -e TMDB_API_KEY=$TMDB_API_KEY \
  -e DEEPGRAM_API_KEY=$DEEPGRAM_API_KEY \
  -e S3_BUCKET_NAME=test-bucket \
  -e AWS_REGION=us-east-1 \
  lambda-test

echo "✓ Container started, waiting 5 seconds..."
sleep 5
echo ""

# Test 1: Session ID Capture
echo "===================="
echo "Test 1: Claude Code Session ID Capture"
echo "===================="
echo "Creating new Claude Code session..."

RESPONSE=$(curl -s -XPOST http://localhost:9000/2015-03-31/functions/function/invocations \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "claude-code",
    "payload": {
      "prompt": "What is 2+2? Please explain briefly.",
      "user_id": "00000000-0000-0000-0000-000000000001",
      "group_id": "00000000-0000-0000-0000-000000000002",
      "parent_content_id": "00000000-0000-0000-0000-000000000003"
    }
  }')

echo "Response:"
echo "$RESPONSE" | jq '.' || echo "$RESPONSE"
echo ""

# Extract session_id from response body
SESSION_ID=$(echo "$RESPONSE" | jq -r '.body | fromjson | .session_id' 2>/dev/null || echo "null")

if [ "$SESSION_ID" = "null" ] || [ -z "$SESSION_ID" ]; then
  echo "❌ FAIL: No session_id in response"
  echo ""
  echo "Docker logs:"
  docker logs lambda-test-pulumi 2>&1 | tail -100
  docker stop lambda-test-pulumi
  exit 1
fi

echo "✓ Session ID captured: $SESSION_ID"
echo ""

# Check logs for session capture
echo "Checking logs for session ID capture validation..."
docker logs lambda-test-pulumi 2>&1 | grep -E "(Session ID captured|source: startup|✓ Session ID)" || echo "No session capture logs found"
echo ""

# Test 2: Conversation Context (requires actual Supabase data)
echo "===================="
echo "Test 2: Conversation Context"
echo "===================="
echo "Checking logs for conversation context fetching..."
docker logs lambda-test-pulumi 2>&1 | grep -E "\[Conversation Context\]" || echo "No conversation context logs (expected if no sibling content exists)"
echo ""

# Summary
echo "===================="
echo "Test Summary"
echo "===================="
echo "✓ Pulumi secrets loaded successfully"
echo "✓ Docker image built successfully"
echo "✓ Lambda container started successfully"
if [ "$SESSION_ID" != "null" ] && [ -n "$SESSION_ID" ]; then
  echo "✓ Session ID captured: $SESSION_ID"
else
  echo "❌ Session ID capture failed"
fi

# Show full logs
echo ""
echo "===================="
echo "Full Docker Logs"
echo "===================="
docker logs lambda-test-pulumi 2>&1

# Clean up
echo ""
echo "Stopping container..."
docker stop lambda-test-pulumi
echo "✓ Container stopped"
echo ""
echo "===================="
echo "Testing Complete"
echo "===================="
