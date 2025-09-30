# Plan: Cloudflare Worker with Queue-Based Claude Code SDK Integration

## Overview
Create a Cloudflare Worker system that uses Queues for longer execution times, accepting prompts via queue messages, executing them through Claude Code SDK with full permissions, and managing session persistence via compressed directories in Supabase Storage.

## Architecture Flow
```
Client → Queue Producer → CF Queue → Queue Consumer Worker → Claude Code SDK → Directory Operations → Zip → Supabase Storage
                                                    ↓
                                           (If session_id exists)
                                                    ↓
                                    Supabase Storage → Download Zip → Extract → Working Directory
```

## Implementation Steps

### 1. Set up Cloudflare Queue Infrastructure
- Create CF Queue: `claude-code-queue`
- Create Producer Worker: Handle HTTP requests and enqueue jobs
- Create Consumer Worker: Process queue messages with extended timeouts

### 2. Queue Message Schema
```typescript
interface ClaudeCodeJob {
  job_id: string;
  prompt: string;
  session_id?: string;
  callback_url?: string; // Optional webhook for completion notification
  timestamp: number;
}
```

### 3. Producer Worker (HTTP → Queue)
```typescript
// POST /execute endpoint
interface RequestBody {
  prompt: string;
  session_id?: string;
  callback_url?: string;
}

// Enqueue job and return job_id for tracking
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const body = await request.json() as RequestBody;

    const job: ClaudeCodeJob = {
      job_id: crypto.randomUUID(),
      prompt: body.prompt,
      session_id: body.session_id,
      callback_url: body.callback_url,
      timestamp: Date.now()
    };

    await env.CLAUDE_CODE_QUEUE.send(job);

    return Response.json({
      job_id: job.job_id,
      status: 'queued',
      message: 'Job queued for processing'
    });
  }
};
```

### 4. Consumer Worker (Queue → Claude Code Execution)
```typescript
export default {
  async queue(batch: MessageBatch<ClaudeCodeJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processClaudeCodeJob(message.body, env);
        message.ack(); // Acknowledge successful processing
      } catch (error) {
        console.error('Job failed:', error);
        message.retry(); // Retry on failure
      }
    }
  }
};

async function processClaudeCodeJob(job: ClaudeCodeJob, env: Env) {
  const workDir = `/tmp/claude-session-${job.job_id}`;

  // 1. Setup working directory
  if (job.session_id) {
    await downloadAndExtractSession(job.session_id, workDir, env);
  } else {
    await createWorkingDirectory(workDir);
  }

  // 2. Execute Claude Code with extended timeout
  const result = await executeClaudeCode(job.prompt, workDir, env.ANTHROPIC_API_KEY);

  // 3. Compress and store session
  const finalSessionId = job.session_id || extractSessionId(result) || job.job_id;
  await compressAndStore(workDir, finalSessionId, env);

  // 4. Notify completion
  if (job.callback_url) {
    await notifyCompletion(job.callback_url, {
      job_id: job.job_id,
      session_id: finalSessionId,
      status: 'completed',
      result: result
    });
  }
}
```

### 5. Extended Timeout Claude Code Integration
```typescript
import { query } from '@anthropic/claude-code-sdk';

async function executeClaudeCode(prompt: string, workDir: string, apiKey: string) {
  // Queue consumers get up to 30 minutes execution time
  const response = await query({
    prompt: prompt,
    options: {
      apiKey: apiKey,
      cwd: workDir,
      permissionMode: 'full',
      model: 'claude-3-sonnet',
      timeout: 25 * 60 * 1000, // 25 minutes max
      hooks: {
        onMessage: (msg) => {
          console.log('Claude Code:', msg);
        },
        onProgress: (progress) => {
          console.log('Progress:', progress);
        }
      }
    }
  });

  let fullResult = '';
  for await (const message of response) {
    fullResult += message;
  }

  return fullResult;
}
```

### 6. Session Management with Queue Support
```typescript
async function downloadAndExtractSession(sessionId: string, workDir: string, env: Env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

  const { data, error } = await supabase.storage
    .from('content')
    .download(`claude-code/${sessionId}.zip`);

  if (error) throw new Error(`Session not found: ${sessionId}`);

  await extractZipToDirectory(data, workDir);
}

async function compressAndStore(workDir: string, sessionId: string, env: Env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

  const zipBuffer = await compressDirectory(workDir, {
    exclude: ['.git', 'node_modules', '.cache', 'dist']
  });

  await supabase.storage
    .from('content')
    .upload(`claude-code/${sessionId}.zip`, zipBuffer, {
      contentType: 'application/zip',
      upsert: true
    });
}
```

### 7. Job Status Tracking (Optional)
```typescript
// Store job status in CF KV for tracking
interface JobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  session_id?: string;
  created_at: number;
  completed_at?: number;
  error?: string;
}

async function updateJobStatus(jobId: string, status: Partial<JobStatus>, env: Env) {
  const existing = await env.JOB_STATUS_KV.get(jobId);
  const current = existing ? JSON.parse(existing) : { job_id: jobId };

  const updated = { ...current, ...status };
  await env.JOB_STATUS_KV.put(jobId, JSON.stringify(updated), {
    expirationTtl: 7 * 24 * 60 * 60 // 7 days
  });
}

// GET /status/:job_id endpoint in producer worker
async function getJobStatus(jobId: string, env: Env) {
  const status = await env.JOB_STATUS_KV.get(jobId);
  return status ? JSON.parse(status) : null;
}
```

### 8. Queue Configuration
```toml
# wrangler.toml
name = "claude-code-producer"
main = "src/producer.ts"

[[queues.consumers]]
queue = "claude-code-queue"
max_batch_size = 1
max_batch_timeout = 30
max_retries = 3
dead_letter_queue = "claude-code-dlq"

[env.production.vars]
SUPABASE_URL = "https://zazsrepfnamdmibcyenx.supabase.co"

[[env.production.queues]]
binding = "CLAUDE_CODE_QUEUE"
queue_name = "claude-code-queue"

[[env.production.kv_namespaces]]
binding = "JOB_STATUS_KV"
id = "your-kv-namespace-id"
```

### 9. Consumer Worker Configuration
```toml
# wrangler-consumer.toml
name = "claude-code-consumer"
main = "src/consumer.ts"

[[queues.consumers]]
queue = "claude-code-queue"
max_batch_size = 1
max_batch_timeout = 30
max_retries = 3
max_concurrency = 2

[env.production.vars]
SUPABASE_URL = "https://zazsrepfnamdmibcyenx.supabase.co"
```

## Key Benefits of Queue Architecture

### Extended Execution Time:
- Queue consumers get **30 minutes** vs 30 seconds for HTTP workers
- Perfect for long-running Claude Code operations
- Built-in retry mechanism for failed jobs

### Scalability:
- Queue automatically handles load balancing
- Multiple consumer instances can process jobs concurrently
- Backpressure handling with queue depth limits

### Reliability:
- Dead letter queue for permanently failed jobs
- Job persistence across worker restarts
- Configurable retry policies

## Required Setup

### 1. Cloudflare Dashboard:
```bash
# Create queue
wrangler queues create claude-code-queue

# Deploy producer worker
wrangler deploy --config wrangler.toml

# Deploy consumer worker
wrangler deploy --config wrangler-consumer.toml

# Set secrets
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put SUPABASE_ANON_KEY
```

### 2. Environment Variables:
- `ANTHROPIC_API_KEY` (secret)
- `SUPABASE_URL` (variable)
- `SUPABASE_ANON_KEY` (secret)

## API Endpoints

### Producer Worker:
- `POST /execute` - Queue Claude Code job
- `GET /status/:job_id` - Check job status

### Consumer Worker:
- Automatic queue processing (no HTTP endpoints)

## File Structure
```
worker/
├── src/
│   ├── producer.ts      # HTTP → Queue
│   ├── consumer.ts      # Queue → Claude Code
│   ├── lib/
│   │   ├── claude-sdk.ts
│   │   ├── storage.ts
│   │   ├── compression.ts
│   │   └── session.ts
├── wrangler.toml        # Producer config
└── wrangler-consumer.toml # Consumer config
```

This architecture provides robust, scalable Claude Code execution with proper session management and extended timeout support via Cloudflare Queues.