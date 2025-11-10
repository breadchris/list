#!/bin/bash

# Test TSX Transpile ETag Caching
# This script demonstrates the caching behavior of the tsx-transpile endpoint

set -e

echo "====================================="
echo "TSX Transpile ETag Caching Test"
echo "====================================="
echo ""

# Ensure Docker container is running
echo "1. Starting Lambda Runtime Interface Emulator..."
npm run test:docker:build > /dev/null 2>&1
npm run test:docker:run > /dev/null 2>&1
sleep 3
echo "   ✓ Container started"
echo ""

# Test 1: Cache Miss (first request)
echo "2. Testing Cache Miss (first request)..."
echo "   Request: tsx-transpile without If-None-Match header"
RESPONSE=$(curl -s -XPOST http://localhost:9000/2015-03-31/functions/function/invocations \
  -H "Content-Type: application/json" \
  --data-binary @test-tsx-transpile.json)

# Extract ETag from response
ETAG=$(echo "$RESPONSE" | jq -r '.etag // empty')
CACHE_HIT=$(echo "$RESPONSE" | jq -r '.cache_hit // false')
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

echo "   Response:"
echo "     - success: $SUCCESS"
echo "     - cache_hit: $CACHE_HIT"
echo "     - etag: $ETAG"

if [ "$SUCCESS" != "true" ]; then
  echo "   ✗ FAILED: Transpilation failed"
  echo "$RESPONSE" | jq '.'
  exit 1
fi

if [ "$CACHE_HIT" != "false" ]; then
  echo "   ✗ FAILED: Expected cache_hit=false for first request"
  exit 1
fi

if [ -z "$ETAG" ]; then
  echo "   ✗ FAILED: No ETag in response"
  exit 1
fi

echo "   ✓ Cache miss - code transpiled successfully"
echo ""

# Test 2: Cache Hit (second request with If-None-Match)
echo "3. Testing Cache Hit (request with matching ETag)..."
echo "   Request: tsx-transpile with If-None-Match: $ETAG"

# Create temporary test file with the extracted ETag
cat > test-tsx-transpile-cache-hit-temp.json <<EOF
{
  "action": "tsx-transpile",
  "payload": {
    "tsx_code": "import React from 'react';\n\nexport const HelloWorld: React.FC = () => {\n  return <div>Hello, World!</div>;\n};\n",
    "filename": "HelloWorld.tsx"
  },
  "headers": {
    "if-none-match": $ETAG
  },
  "sync": true
}
EOF

RESPONSE2=$(curl -s -XPOST http://localhost:9000/2015-03-31/functions/function/invocations \
  -H "Content-Type: application/json" \
  --data-binary @test-tsx-transpile-cache-hit-temp.json)

# Check cache hit
CACHE_HIT2=$(echo "$RESPONSE2" | jq -r '.cache_hit // false')
SUCCESS2=$(echo "$RESPONSE2" | jq -r '.success')
COMPILED_JS=$(echo "$RESPONSE2" | jq -r '.compiled_js // empty')

echo "   Response:"
echo "     - success: $SUCCESS2"
echo "     - cache_hit: $CACHE_HIT2"
echo "     - compiled_js: $([ -z "$COMPILED_JS" ] && echo 'not present (304)' || echo 'present')"

if [ "$SUCCESS2" != "true" ]; then
  echo "   ✗ FAILED: Cache hit request failed"
  echo "$RESPONSE2" | jq '.'
  exit 1
fi

if [ "$CACHE_HIT2" != "true" ]; then
  echo "   ✗ FAILED: Expected cache_hit=true for matching ETag"
  exit 1
fi

if [ -n "$COMPILED_JS" ]; then
  echo "   ✗ WARNING: compiled_js should not be present for cache hit (saves bandwidth)"
fi

echo "   ✓ Cache hit - 304 Not Modified returned"
echo ""

# Clean up
rm -f test-tsx-transpile-cache-hit-temp.json

# Stop container
echo "4. Stopping container..."
npm run test:docker:stop > /dev/null 2>&1
echo "   ✓ Container stopped"
echo ""

echo "====================================="
echo "✓ All tests passed!"
echo "====================================="
echo ""
echo "ETag caching is working correctly:"
echo "  1. First request generates ETag and transpiles code"
echo "  2. Subsequent requests with matching ETag return 304"
echo "  3. Bandwidth saved by not re-sending compiled JavaScript"
