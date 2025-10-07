#!/bin/bash
# Local Docker test script for Lambda function

set -e

echo "Building Docker image..."
docker build -t claude-lambda-test .

echo ""
echo "Starting Lambda container..."
docker run --rm -p 9000:8080 \
  -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
  -e AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}" \
  -e AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}" \
  -e AWS_REGION="us-east-1" \
  -e S3_BUCKET_NAME="claude-code-sessions" \
  -e NODE_ENV="development" \
  claude-lambda-test &

CONTAINER_PID=$!

echo "Waiting for Lambda to be ready..."
sleep 3

echo ""
echo "Testing Lambda with curl..."
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "{\"prompt\": \"What is 2 + 2?\"}",
    "requestContext": {
      "http": {
        "method": "POST"
      }
    },
    "rawPath": "/claude-code"
  }' | jq '.'

echo ""
echo "Stopping container..."
kill $CONTAINER_PID
wait $CONTAINER_PID 2>/dev/null || true

echo "Done!"
