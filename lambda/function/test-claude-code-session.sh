#!/bin/bash
# Test script for Claude Code session management and conversation context

set -e  # Exit on error

echo "===================="
echo "Claude Code Session Testing"
echo "===================="
echo ""

# Check required environment variables
echo "Checking environment variables..."
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "❌ ERROR: ANTHROPIC_API_KEY not set"
  echo "   Please set it: export ANTHROPIC_API_KEY='your-key'"
  exit 1
fi

if [ -z "$SUPABASE_URL" ]; then
  echo "❌ ERROR: SUPABASE_URL not set"
  echo "   Please set it: export SUPABASE_URL='https://zazsrepfnamdmibcyenx.supabase.co'"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not set"
  echo "   Please set it: export SUPABASE_SERVICE_ROLE_KEY='your-key'"
  exit 1
fi

echo "✓ All environment variables set"
echo ""

# Build Docker image
echo "Building Docker image..."
npm run test:docker:build
echo "✓ Docker image built"
echo ""

# Start Lambda container
echo "Starting Lambda container..."
docker run --rm -d -p 9000:8080 --name lambda-test-claude \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e SUPABASE_URL=$SUPABASE_URL \
  -e SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
  -e S3_BUCKET_NAME=test-bucket \
  -e AWS_REGION=us-east-1 \
  lambda-test

echo "✓ Container started, waiting 3 seconds..."
sleep 3
echo ""

# Test 1: Session ID Capture
echo "===================="
echo "Test 1: Session ID Capture"
echo "===================="
echo "Creating new Claude Code session..."

RESPONSE=$(curl -s -XPOST http://localhost:9000/2015-03-31/functions/function/invocations \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "claude-code",
    "payload": {
      "prompt": "What is 2+2? Please explain briefly.",
      "user_id": "test-user-123",
      "group_id": "test-group-456",
      "parent_content_id": "test-parent-789"
    }
  }')

echo "Response:"
echo "$RESPONSE" | jq '.'
echo ""

# Extract session_id
SESSION_ID=$(echo "$RESPONSE" | jq -r '.session_id')

if [ "$SESSION_ID" = "null" ] || [ -z "$SESSION_ID" ]; then
  echo "❌ FAIL: No session_id in response"
  docker logs lambda-test-claude 2>&1 | tail -50
  docker stop lambda-test-claude
  exit 1
fi

echo "✓ Session ID captured: $SESSION_ID"
echo ""

# Check logs for session capture
echo "Checking logs for session capture..."
docker logs lambda-test-claude 2>&1 | grep -E "(Session ID captured|source: startup)" || true
echo ""

# Test 2: Session Resumption
echo "===================="
echo "Test 2: Session Resumption"
echo "===================="
echo "Resuming session: $SESSION_ID"

RESPONSE2=$(curl -s -XPOST http://localhost:9000/2015-03-31/functions/function/invocations \
  -H 'Content-Type: application/json' \
  -d "{
    \"action\": \"claude-code\",
    \"payload\": {
      \"prompt\": \"What was my previous question?\",
      \"session_id\": \"$SESSION_ID\",
      \"user_id\": \"test-user-123\",
      \"group_id\": \"test-group-456\",
      \"parent_content_id\": \"test-parent-789\"
    }
  }")

echo "Response:"
echo "$RESPONSE2" | jq '.'
echo ""

# Check for resume in logs
echo "Checking logs for session resumption..."
docker logs lambda-test-claude 2>&1 | grep -E "(source: resume)" || true
echo ""

# Test 3: Conversation Context
echo "===================="
echo "Test 3: Conversation Context"
echo "===================="
echo "Checking logs for conversation context fetching..."
docker logs lambda-test-claude 2>&1 | grep -E "\[Conversation Context\]" || echo "No conversation context logs found (expected if no sibling content exists)"
echo ""

# Summary
echo "===================="
echo "Test Summary"
echo "===================="
echo "✓ TypeScript compiles successfully"
echo "✓ Docker image builds successfully"
echo "✓ Lambda container starts successfully"
if [ "$SESSION_ID" != "null" ] && [ -n "$SESSION_ID" ]; then
  echo "✓ Session ID captured: $SESSION_ID"
else
  echo "❌ Session ID capture failed"
fi

# Clean up
echo ""
echo "Stopping container..."
docker stop lambda-test-claude
echo "✓ Container stopped"
echo ""
echo "===================="
echo "Testing Complete"
echo "===================="
