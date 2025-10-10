#!/bin/bash

# Test YouTube Playlist Extraction Workflow
# This script tests the youtube-playlist-extract action in the content Edge Function

# Example test with local Supabase (adjust URL and auth token as needed)
echo "Testing YouTube Playlist Extraction..."
echo ""

# NOTE: Replace these values with your actual setup
SUPABASE_URL="http://localhost:54321/functions/v1/content"
AUTH_TOKEN="YOUR_AUTH_TOKEN_HERE"

# Test payload
curl -X POST "$SUPABASE_URL" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-youtube-playlist.json

echo ""
echo ""
echo "Expected result:"
echo "- Success response with videos_created count"
echo "- Child content items created in database with:"
echo "  - type: 'text'"
echo "  - data: '<Video Title>\\n<Video URL>'"
echo "  - metadata: Contains youtube_video_id, youtube_title, youtube_duration, etc."
