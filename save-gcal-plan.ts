/**
 * Script to save Google Calendar Two-Way Sync Implementation Plan to database
 *
 * Usage: npx tsx save-gcal-plan.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zazsrepfnamdmibcyenx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphenp6cmVwZm5hbWRtaWJjeWVueCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzI2OTY0NzE1LCJleHAiOjIwNDI1NDA3MTV9.TlrKiGlJqZ-Td5S03DsqGKBEtNPXKzgJz_KW0Sx3F0o';

const GROUP_ID = '249612fd-63b7-49fd-a564-1f31c07e0e17';

const PLAN_CONTENT = `# Google Calendar Two-Way Sync Implementation

## Overview
Implement full two-way synchronization between the app's content system and Google Calendar, allowing events to flow bidirectionally with conflict resolution.

## Architecture

### Backend (AWS Lambda)
- **New handler**: \`google-calendar-sync\` in \`/lambda/function/src/google-calendar-sync.ts\`
- **Google Calendar API client** using googleapis npm package
- **Webhook endpoint** for receiving Google Calendar push notifications
- **Environment variables**: \`GOOGLE_CALENDAR_CLIENT_ID\`, \`GOOGLE_CALENDAR_CLIENT_SECRET\`

### Frontend
- **New hook**: \`/hooks/useGoogleCalendarSync.ts\` - OAuth flow and sync state
- **New component**: \`/components/GoogleCalendarSyncModal.tsx\` - Setup and sync settings
- **Update**: \`/components/SupabaseClient.ts\` - Add \`linkGoogleCalendar()\` function
- **Update**: \`/hooks/useLinkedAccounts.ts\` - Include Google Calendar in linked identities

### Database
- **New table**: \`calendar_sync_state\` - Track sync tokens and last sync time
- **New table**: \`calendar_event_mapping\` - Map content items to Google Calendar event IDs
- **Update**: \`content\` metadata - Add \`google_calendar_id\`, \`google_calendar_etag\` fields

## Key Features

### 1. OAuth Integration
- Add Google Calendar scopes: \`https://www.googleapis.com/auth/calendar.events\`
- Extend existing Google OAuth to request calendar permissions
- Store refresh token for background sync

### 2. Initial Sync
- Import all Google Calendar events as content items (type: \`calendar-event\`)
- Export existing content items with dates to Google Calendar
- Show conflict resolution UI for duplicates

### 3. Bidirectional Updates
- **App → Google**: Create/update/delete Google Calendar events when content changes
- **Google → App**: Webhook listener for push notifications on calendar changes
- Use ETags and sync tokens to avoid conflicts

### 4. Conflict Resolution
- Timestamp-based priority (most recent change wins)
- Manual resolution UI for complex conflicts
- Option to keep both versions

### 5. Sync Settings
- Enable/disable auto-sync
- Select which calendars to sync
- Filter by content type (only sync events, not all content)
- Sync frequency (real-time via webhooks + hourly backup poll)

## Implementation Steps

1. **Add Google Calendar API dependencies** to Lambda package.json
2. **Update Supabase OAuth provider** with calendar scopes
3. **Create database migrations** for sync tables
4. **Implement Lambda sync handler** with Calendar API integration
5. **Create frontend OAuth flow** for calendar linking
6. **Build sync UI** with settings and status
7. **Set up webhook channel** for push notifications
8. **Add conflict resolution** logic and UI
9. **Update calendar views** to show sync status
10. **Document setup process** in CLAUDE.md

## Files to Create

### Backend
- \`/lambda/function/src/google-calendar-sync.ts\` - Main sync handler
- \`/lambda/function/src/google-calendar-client.ts\` - Google Calendar API wrapper
- \`/lambda/function/src/calendar-webhook.ts\` - Webhook endpoint for push notifications

### Frontend
- \`/hooks/useGoogleCalendarSync.ts\` - OAuth and sync state management
- \`/components/GoogleCalendarSyncModal.tsx\` - Sync setup and settings UI
- \`/types/GoogleCalendarTypes.ts\` - Type definitions for calendar sync

### Database
- \`/supabase/migrations/*_add_calendar_sync_state_table.sql\`
- \`/supabase/migrations/*_add_calendar_event_mapping_table.sql\`
- \`/supabase/migrations/*_add_content_calendar_metadata.sql\`

## Files to Modify

### Backend
- \`/lambda/function/src/index.ts\` - Add calendar sync and webhook routes
- \`/lambda/function/package.json\` - Add googleapis dependency

### Frontend
- \`/components/SupabaseClient.ts\` - Add \`linkGoogleCalendar()\` and \`unlinkGoogleCalendar()\`
- \`/hooks/useLinkedAccounts.ts\` - Include Google Calendar identity
- \`/components/CalendarPage.tsx\` - Add sync button and status indicator

### Documentation
- \`/components/CLAUDE.md\` - Document Google Calendar OAuth setup
- \`/lambda/CLAUDE.md\` - Document sync handler implementation

## Database Schema

### calendar_sync_state
\`\`\`sql
CREATE TABLE calendar_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  google_calendar_id TEXT NOT NULL,
  sync_token TEXT,
  last_sync_at TIMESTAMPTZ,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id, google_calendar_id)
);
\`\`\`

### calendar_event_mapping
\`\`\`sql
CREATE TABLE calendar_event_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  google_calendar_id TEXT NOT NULL,
  google_event_id TEXT NOT NULL,
  etag TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(content_id),
  UNIQUE(google_calendar_id, google_event_id)
);
\`\`\`

## OAuth Configuration

### Supabase Dashboard
1. Go to Authentication > Providers > Google
2. Add calendar scope: \`https://www.googleapis.com/auth/calendar.events\`
3. Existing scopes should remain: \`email\`, \`profile\`, \`openid\`

### Google Cloud Console
1. Enable Google Calendar API
2. Add authorized redirect URI: \`https://zazsrepfnamdmibcyenx.supabase.co/auth/v1/callback\`
3. Ensure OAuth consent screen includes calendar access explanation

## API Endpoints

### Lambda Endpoints
- \`POST /google-calendar/sync\` - Trigger manual sync
- \`POST /google-calendar/webhook\` - Receive push notifications
- \`GET /google-calendar/status\` - Get sync status
- \`POST /google-calendar/link\` - Link Google Calendar account
- \`DELETE /google-calendar/unlink\` - Unlink Google Calendar

### Request/Response Examples

#### Trigger Sync
\`\`\`typescript
POST /google-calendar/sync
{
  "group_id": "uuid",
  "calendar_id": "primary" | "specific-calendar-id",
  "direction": "both" | "to-google" | "from-google"
}

Response:
{
  "status": "success",
  "events_imported": 42,
  "events_exported": 15,
  "conflicts": 3
}
\`\`\`

## Conflict Resolution Strategy

### Timestamp Comparison
1. Compare \`updated_at\` (app) vs \`updated\` (Google Calendar)
2. Most recent change wins by default
3. Store conflict in separate table for manual resolution

### Conflict Types
- **Update conflict**: Both sides modified since last sync
- **Delete conflict**: Deleted on one side, modified on other
- **Duplicate conflict**: Similar events on both sides during initial sync

### Resolution UI
- Show side-by-side comparison
- Options: Keep App, Keep Google, Keep Both, Merge
- Allow manual field-by-field selection

## Testing Strategy

### Unit Tests
- Google Calendar API client wrapper
- Sync logic with mock data
- Conflict resolution algorithms

### Integration Tests
- OAuth flow with test Google account
- Initial sync with sample calendar data
- Webhook handling with simulated notifications

### E2E Tests
- Complete sync workflow
- Conflict resolution UI
- Multi-calendar management

## Security Considerations

### Token Storage
- Store refresh tokens encrypted in database
- Use Supabase Vault for sensitive credentials
- Rotate tokens periodically

### Webhook Verification
- Verify webhook signatures from Google
- Rate limit webhook endpoint
- Validate channel IDs and resource IDs

### Data Privacy
- Only sync calendars explicitly authorized by user
- Respect calendar visibility settings
- Allow users to exclude specific calendars

## Performance Optimization

### Batch Operations
- Batch Google Calendar API requests (max 50 per batch)
- Use incremental sync with sync tokens
- Implement exponential backoff for rate limits

### Caching
- Cache calendar metadata (name, timezone, etc.)
- Store ETags to avoid unnecessary updates
- Implement local change tracking to minimize API calls

### Background Jobs
- Run periodic sync in Lambda on schedule (hourly)
- Use webhooks for real-time updates
- Queue large sync operations

## Monitoring and Logging

### Metrics to Track
- Sync success rate
- Sync duration
- API quota usage
- Conflict frequency
- Webhook delivery success rate

### Error Handling
- Log all sync errors with context
- Notify users of persistent failures
- Automatic retry with exponential backoff
- Fallback to manual sync if webhooks fail

## Future Enhancements

### Phase 2
- Multi-calendar support (work, personal, etc.)
- Selective sync (filter by tags, content type)
- Custom field mapping
- Sync history and audit log

### Phase 3
- Support for other calendar providers (Outlook, Apple Calendar)
- Smart duplicate detection with ML
- Automated conflict resolution with user preferences
- Calendar analytics and insights

## References

### Documentation
- [Google Calendar API v3](https://developers.google.com/calendar/api/v3/reference)
- [Push Notifications](https://developers.google.com/calendar/api/guides/push)
- [Supabase OAuth Guide](https://supabase.com/docs/guides/auth/social-login/auth-google)

### Libraries
- [\`googleapis\`](https://www.npmjs.com/package/googleapis) - Official Google APIs client
- [\`@supabase/supabase-js\`](https://www.npmjs.com/package/@supabase/supabase-js) - Supabase client

## Timeline Estimate

- **Week 1**: OAuth setup, database schema, basic sync logic
- **Week 2**: Bidirectional sync, webhook implementation
- **Week 3**: Conflict resolution UI, testing
- **Week 4**: Polish, documentation, deployment

Total: ~4 weeks for MVP implementation`;

async function main() {
  // Note: This script requires authentication
  // You'll need to get the user's auth token from the browser session
  console.log('⚠️  This script requires authentication.');
  console.log('Please use one of the following methods:\n');

  console.log('Option 1: Run this in browser console');
  console.log('=========================================');
  console.log(`
const supabase = (await import('./components/SupabaseClient.js')).supabase;
const repository = new (await import('./components/ContentRepository.js')).ContentRepository();

const planData = ${JSON.stringify(PLAN_CONTENT)};

const result = await repository.createContent({
  type: 'text',
  data: planData,
  group_id: '${GROUP_ID}'
});

console.log('✅ Plan saved with ID:', result.id);
console.log('View at: http://localhost:3002/group/${GROUP_ID}/content/' + result.id);
  `);

  console.log('\nOption 2: Manual Creation');
  console.log('=========================');
  console.log('1. Navigate to http://localhost:3002/group/' + GROUP_ID);
  console.log('2. Click the + button to create new content');
  console.log('3. Paste the plan content (saved to clipboard if running in supported environment)');

  // Try to copy to clipboard if available
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(PLAN_CONTENT);
      console.log('\n📋 Plan content copied to clipboard!');
    } catch (e) {
      console.log('\n⚠️  Could not copy to clipboard');
    }
  }

  console.log('\n📄 Plan content preview:');
  console.log('='.repeat(80));
  console.log(PLAN_CONTENT.substring(0, 500) + '...\n');
}

main().catch(console.error);
