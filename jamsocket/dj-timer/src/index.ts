import { Server } from 'socket.io';
import http from 'http';

const PORT = process.env.PORT || 8080;

interface TimerState {
  is_playing: boolean;
  start_time: number; // server timestamp when playback started
  pause_position: number; // position in seconds when paused
  current_duration: number; // duration of current video
  playback_rate: number;
}

const state: TimerState = {
  is_playing: false,
  start_time: 0,
  pause_position: 0,
  current_duration: 0,
  playback_rate: 1,
};

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

function getCurrentPosition(): number {
  if (!state.is_playing) return state.pause_position;
  const elapsed = ((Date.now() - state.start_time) / 1000) * state.playback_rate;
  return state.pause_position + elapsed;
}

function checkVideoEnd() {
  if (!state.is_playing || state.current_duration <= 0) return;

  const position = getCurrentPosition();
  if (position >= state.current_duration - 0.5) {
    // Video ended - notify all clients
    console.log(`[Timer] Video ended at position ${position}/${state.current_duration}`);
    state.is_playing = false;
    state.pause_position = 0;
    io.emit('video-ended');
  }
}

// Server-side timer - runs regardless of browser tab state!
const timerInterval = setInterval(checkVideoEnd, 500);

function getStateForClient() {
  return {
    position: getCurrentPosition(),
    is_playing: state.is_playing,
    playback_rate: state.playback_rate,
    current_duration: state.current_duration,
  };
}

io.on('connection', (socket) => {
  console.log(`[Timer] Client connected: ${socket.id}`);

  // Send current state to new client
  socket.emit('sync', getStateForClient());

  socket.on('play', () => {
    console.log(`[Timer] Play from client ${socket.id}`);
    if (!state.is_playing) {
      state.is_playing = true;
      state.start_time = Date.now();
      io.emit('sync', getStateForClient());
    }
  });

  socket.on('pause', () => {
    console.log(`[Timer] Pause from client ${socket.id}`);
    if (state.is_playing) {
      state.pause_position = getCurrentPosition();
      state.is_playing = false;
      io.emit('sync', getStateForClient());
    }
  });

  socket.on('seek', (position: number) => {
    console.log(`[Timer] Seek to ${position} from client ${socket.id}`);
    state.pause_position = position;
    if (state.is_playing) {
      state.start_time = Date.now();
    }
    io.emit('sync', getStateForClient());
  });

  socket.on('set-duration', (duration: number) => {
    console.log(`[Timer] Set duration to ${duration} from client ${socket.id}`);
    state.current_duration = duration;
  });

  socket.on('set-rate', (rate: number) => {
    console.log(`[Timer] Set rate to ${rate} from client ${socket.id}`);
    if (state.is_playing) {
      state.pause_position = getCurrentPosition();
      state.start_time = Date.now();
    }
    state.playback_rate = rate;
    io.emit('sync', getStateForClient());
  });

  socket.on('video-changed', () => {
    console.log(`[Timer] Video changed from client ${socket.id}`);
    // Reset timer for new video
    state.pause_position = 0;
    state.start_time = Date.now();
    state.current_duration = 0;
    io.emit('sync', { position: 0, ...getStateForClient() });
  });

  socket.on('get-time', () => {
    socket.emit('sync', getStateForClient());
  });

  socket.on('disconnect', () => {
    console.log(`[Timer] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`[Timer] DJ Timer server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Timer] Received SIGTERM, shutting down...');
  clearInterval(timerInterval);
  io.close();
  server.close();
  process.exit(0);
});
