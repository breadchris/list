# DJ Timer - Jamsocket Session Backend

This is a Jamsocket session backend that provides server-side video timing for the DJ app.

## Problem Solved

Browser tabs throttle timers when inactive, causing YouTube video progression to fail. This backend maintains an authoritative server-side timer that runs regardless of client tab state.

## Architecture

- Y-Sweet handles CRDT state sync (queue, metadata)
- This backend handles authoritative playback timing
- When the server detects video end, it notifies clients to trigger nextVideo() in Y-Sweet

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the dev server:
   ```bash
   npm run dev
   ```
   Or use Jamsocket's dev mode:
   ```bash
   npx jamsocket dev --dockerfile ./Dockerfile --watch .
   ```

3. Set the environment variable in the chat app:
   ```
   NEXT_PUBLIC_DJ_TIMER_URL=http://localhost:8080
   ```

4. Enable the feature flag in localStorage:
   ```javascript
   localStorage.setItem('featureFlag_enableServerTimer', 'true')
   ```

## Production Deployment

1. Create a Jamsocket account at https://jamsocket.com

2. Create a service:
   ```bash
   npx jamsocket service create dj-timer
   ```

3. Push the backend:
   ```bash
   npx jamsocket push dj-timer -f Dockerfile
   ```

4. Add your Jamsocket API token to environment variables:
   ```
   JAMSOCKET_API_TOKEN=your_token_here
   JAMSOCKET_ACCOUNT=your_account_name
   JAMSOCKET_SERVICE=dj-timer
   ```

5. Update the DJ room page to spawn backends using the Jamsocket API

## Socket.IO Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `play` | - | Start/resume playback |
| `pause` | - | Pause playback |
| `seek` | `number` | Seek to position (seconds) |
| `set-duration` | `number` | Set video duration (seconds) |
| `set-rate` | `number` | Set playback rate (e.g., 1.5) |
| `video-changed` | - | Reset timer for new video |
| `get-time` | - | Request current time sync |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `sync` | `{ position, is_playing, playback_rate, current_duration }` | Current playback state |
| `video-ended` | - | Server detected video end |

## Feature Flag

The server timer is controlled by the `enableServerTimer` feature flag:
- **OFF** (default): Client-side video completion detection
- **ON**: Server-side timing via this backend
