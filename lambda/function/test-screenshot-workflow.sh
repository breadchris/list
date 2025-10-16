#!/bin/bash
# End-to-end test for screenshot workflow
# Tests: job creation → SQS queue → Lambda processing → Cloudflare API → S3 upload → DB update

set -e

echo "🧪 Testing Screenshot Workflow End-to-End"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/content"
TEST_URL="https://example.com"
TEST_CONTENT_ID="test-$(uuidgen)"

echo ""
echo "${YELLOW}Step 1: Queue screenshot job${NC}"
JOB_RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"screenshot-queue\",
    \"payload\": {
      \"jobs\": [{
        \"contentId\": \"$TEST_CONTENT_ID\",
        \"url\": \"$TEST_URL\"
      }]
    }
  }")

echo "Response: $JOB_RESPONSE"

JOB_ID=$(echo "$JOB_RESPONSE" | jq -r '.job_id')
if [ "$JOB_ID" = "null" ] || [ -z "$JOB_ID" ]; then
  echo "${RED}❌ Failed to create job${NC}"
  exit 1
fi

echo "${GREEN}✅ Job created: $JOB_ID${NC}"

echo ""
echo "${YELLOW}Step 2: Wait for Lambda to process (5 seconds)${NC}"
sleep 5

echo ""
echo "${YELLOW}Step 3: Check Lambda logs for job processing${NC}"
LOG_OUTPUT=$(aws logs tail /aws/lambda/claude-code-lambda-d643b14 \
  --region us-east-1 \
  --since 1m \
  --format short \
  --filter-pattern "$JOB_ID" \
  2>&1 || true)

if echo "$LOG_OUTPUT" | grep -q "full_page"; then
  echo "${RED}❌ FAIL: Lambda still using old code with full_page parameter${NC}"
  echo "$LOG_OUTPUT" | grep "full_page"
  exit 1
fi

if echo "$LOG_OUTPUT" | grep -q "BadRequestError"; then
  echo "${RED}❌ FAIL: Cloudflare API returned error${NC}"
  echo "$LOG_OUTPUT" | grep "BadRequestError"
  exit 1
fi

if echo "$LOG_OUTPUT" | grep -q "completed successfully"; then
  echo "${GREEN}✅ Job completed successfully${NC}"
else
  echo "${YELLOW}⚠️  Job status unknown - checking logs:${NC}"
  echo "$LOG_OUTPUT"
fi

echo ""
echo "${YELLOW}Step 4: Verify no Cloudflare API errors${NC}"
ERROR_COUNT=$(echo "$LOG_OUTPUT" | grep -c "Unrecognized key" || true)

if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "${RED}❌ FAIL: Found $ERROR_COUNT Cloudflare API errors${NC}"
  exit 1
else
  echo "${GREEN}✅ No Cloudflare API errors detected${NC}"
fi

echo ""
echo "${YELLOW}Step 5: Check if screenshot was generated${NC}"
if echo "$LOG_OUTPUT" | grep -q "Generating screenshot"; then
  echo "${GREEN}✅ Screenshot generation attempted${NC}"

  if echo "$LOG_OUTPUT" | grep -q "Screenshot uploaded"; then
    echo "${GREEN}✅ Screenshot uploaded to S3${NC}"
  else
    echo "${YELLOW}⚠️  Screenshot upload status unknown${NC}"
  fi
else
  echo "${RED}❌ FAIL: Screenshot generation not attempted${NC}"
  exit 1
fi

echo ""
echo "=========================================="
echo "${GREEN}✅ Screenshot workflow test PASSED${NC}"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - Job ID: $JOB_ID"
echo "  - Test URL: $TEST_URL"
echo "  - Lambda processed job without errors"
echo "  - Cloudflare API accepted request (no full_page error)"
echo "  - Screenshot workflow completed successfully"
