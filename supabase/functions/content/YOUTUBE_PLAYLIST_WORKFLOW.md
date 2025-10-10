# YouTube Playlist Extraction Workflow

## Overview
This workflow detects YouTube playlist URLs in text content, fetches all videos from the playlist via the Lambda endpoint, and creates child content items for each video.

## Implementation

### Files Modified
- `supabase/functions/content/index.ts` - Added YouTube playlist extraction functionality

### New Action: `youtube-playlist-extract`

**Request Format**:
```json
{
  "action": "youtube-playlist-extract",
  "payload": {
    "selectedContent": [
      {
        "id": "content-id",
        "type": "text",
        "data": "Check out: https://www.youtube.com/playlist?list=PLnbzopdwFrnZc-UgGYETAQair7VzS7_Z8",
        "group_id": "group-id",
        "user_id": "user-id",
        "parent_content_id": null
      }
    ]
  }
}
```

**Response Format**:
```json
{
  "success": true,
  "data": [
    {
      "content_id": "content-id",
      "success": true,
      "playlists_found": 1,
      "videos_created": 115,
      "playlist_children": [/* array of created content items */],
      "errors": null
    }
  ]
}
```

## How It Works

### 1. URL Detection
The workflow uses a regex pattern to detect YouTube playlist URLs:
```typescript
/https?:\/\/(?:www\.)?youtube\.com\/(?:watch\?.*list=|playlist\?list=)([\w-]+)/gi
```

This matches:
- `https://www.youtube.com/playlist?list=PLxxx`
- `https://www.youtube.com/watch?v=xxx&list=PLxxx`

### 2. Lambda Integration
For each detected playlist URL, the workflow calls the Lambda endpoint:
```
POST https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/youtube/playlist
{
  "url": "https://www.youtube.com/playlist?list=PLxxx"
}
```

The Lambda returns:
```json
{
  "success": true,
  "videos": [
    {
      "id": "video-id",
      "title": "Video Title",
      "url": "https://www.youtube.com/watch?v=video-id",
      "duration": 399
    }
  ]
}
```

### 3. Child Content Creation
For each video in the playlist, a child content item is created with:

**Content Structure**:
- `type`: `'text'`
- `data`: `"Video Title\nhttps://www.youtube.com/watch?v=xxx"` (title and URL on separate lines)
- `parent_content_id`: The original content item containing the playlist URL
- `group_id`: Inherited from parent
- `user_id`: Inherited from parent

**Metadata**:
```json
{
  "youtube_video_id": "video-id",
  "youtube_title": "Video Title",
  "youtube_duration": 399,
  "source_playlist_url": "https://www.youtube.com/playlist?list=PLxxx",
  "extracted_from_playlist": true
}
```

## Usage Examples

### From TypeScript/JavaScript Client
```typescript
const response = await fetch('https://your-project.supabase.co/functions/v1/content', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'youtube-playlist-extract',
    payload: {
      selectedContent: [{
        id: contentId,
        type: 'text',
        data: 'Check out: https://www.youtube.com/playlist?list=PLnbzopdwFrnZc-UgGYETAQair7VzS7_Z8',
        group_id: groupId,
        user_id: userId,
        parent_content_id: null
      }]
    }
  })
});

const result = await response.json();
console.log(`Created ${result.data[0].videos_created} video items`);
```

### Testing Locally
```bash
# Using the test script
cd supabase/functions/content
./test-youtube-playlist.sh

# Or manually with curl
curl -X POST "http://localhost:54321/functions/v1/content" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-youtube-playlist.json
```

## Database Schema

### Content Table
The workflow uses the existing `content` table structure:

```sql
-- No migration needed, uses existing schema
CREATE TABLE content (
  id uuid PRIMARY KEY,
  type text NOT NULL,           -- 'text' for video items
  data text NOT NULL,            -- 'Title\nURL' format
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  parent_content_id uuid,        -- Points to parent content with playlist
  metadata jsonb,                -- Contains YouTube video metadata
  created_at timestamptz,
  updated_at timestamptz
);
```

## Error Handling

The workflow includes robust error handling:

1. **Per-playlist errors**: If one playlist fails, others continue processing
2. **Partial success**: Returns success=true even if some playlists fail (with errors array)
3. **Database errors**: Caught and logged, doesn't crash the entire operation
4. **Lambda errors**: HTTP errors from Lambda are caught and reported

**Example error response**:
```json
{
  "success": true,
  "data": [{
    "content_id": "content-id",
    "success": false,
    "playlists_found": 1,
    "videos_created": 0,
    "errors": ["Error processing https://...: Lambda error: 400"]
  }]
}
```

## Integration Points

### Upstream Dependencies
- **Lambda YouTube Endpoint**: `https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/youtube/playlist`
  - Built with Go binary using `github.com/kkdai/youtube/v2 v2.10.4`
  - Deployed via Pulumi
  - Returns video metadata for playlist URLs

### Downstream Usage
- Client applications can call the content Edge Function with action `youtube-playlist-extract`
- Created child content items appear in UI as children of the original content
- Each video item can be further processed (SEO extraction, screenshots, etc.)

## Performance Considerations

1. **Playlist Size**: Large playlists (100+ videos) may take several seconds to process
2. **Bulk Inserts**: Videos are inserted in batch per playlist for efficiency
3. **Lambda Timeout**: Lambda has 5-minute timeout, sufficient for large playlists
4. **Edge Function Timeout**: Supabase Edge Functions have default timeout limits

## Future Enhancements

Potential improvements:
1. Queue support for async processing of large playlists
2. Deduplication check to avoid creating duplicate video items
3. Progress callbacks for real-time updates during processing
4. Support for individual video URLs (not just playlists)
5. Configurable content format (currently hardcoded as `Title\nURL`)

## Testing

Test files created:
- `test-youtube-playlist.json` - Sample request payload
- `test-youtube-playlist.sh` - Shell script for testing

Run tests with:
```bash
cd supabase/functions/content
./test-youtube-playlist.sh
```
