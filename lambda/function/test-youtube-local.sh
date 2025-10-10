#!/bin/bash
set -e

echo "🔨 Building Docker image with Go support..."
docker build -t claude-lambda-youtube .

echo "✅ Build complete"
echo ""
echo "🚀 Starting Lambda Runtime Interface Emulator..."
echo "   Listening on http://localhost:9000"
echo ""

# Run Lambda container
docker run --rm -p 9000:8080 \
  -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
  -e AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}" \
  -e AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}" \
  -e AWS_REGION="us-east-1" \
  -e S3_BUCKET_NAME="claude-code-sessions" \
  -e NODE_ENV="development" \
  -e HOME="/tmp" \
  claude-lambda-youtube &

CONTAINER_PID=$!

echo "⏳ Waiting for Lambda to be ready..."
sleep 5

echo ""
echo "📡 Testing YouTube playlist endpoint..."
echo ""

curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -H "Content-Type: application/json" \
  -d @test-youtube-payload.json | jq '.'

echo ""
echo "🛑 Stopping Lambda container..."
kill $CONTAINER_PID

echo "✅ Test complete"
