# Local Development Guide

This guide explains how to run the complete development stack locally using Docker for both Supabase and AWS Lambda.

## Overview

The local development stack includes:

- **Supabase** - PostgreSQL database, PostgREST API, Auth, Realtime, Storage (ports 54321-54324)
- **Lambda** - AWS Lambda function running in Docker with Lambda Runtime Interface Emulator (port 9000)
- **Frontend** - Go HTTP server serving the React/TypeScript app (port 3002)

## Prerequisites

- **Docker Desktop** - Must be installed and running
- **Node.js & npm** - For package management
- **Go** - For running the CLI
- **Supabase CLI** - Installed via npm (`npx supabase`)

## Quick Start

### 1. Configure API Keys

Edit `data/config.local.json` and add your API keys:

```json
{
  "anthropic_api_key": "sk-ant-...",
  "openai_api_key": "sk-...",
  "cloudflare_api_key": "your_key",
  "cloudflare_account_id": "your_id",
  "tmdb_api_key": "your_key",
  "deepgram_api_key": "your_key"
}
```

**Note**: The Supabase keys are pre-configured for local development and don't need to be changed.

### 2. Start Local Stack

```bash
npm run local
# or
go run . local
```

This command will:
1. Check that Docker is running
2. Start Supabase services (PostgreSQL, PostgREST, Auth, etc.)
3. Build and start Lambda Docker container
4. Start the frontend dev server
5. Stream aggregated logs from all services

### 3. Access Services

Once started, you can access:

- **Frontend**: http://localhost:3002
- **Supabase API**: http://localhost:54321
- **Supabase Studio**: http://localhost:54323 (Database UI)
- **Lambda**: http://localhost:9000 (for direct invocations)

### 4. Stop Local Stack

Press `Ctrl+C` in the terminal where the stack is running, or run:

```bash
npm run local:stop
# or
go run . local stop
```

## Commands

### Start Stack

```bash
npm run local
```

Starts all services and streams logs. Press `Ctrl+C` to stop everything.

### Stop Stack

```bash
npm run local:stop
```

Stops all running services gracefully.

### Tail Logs

```bash
npm run local:logs
```

Tail logs from the Lambda container (if you need to inspect logs without restarting).

### Reset Database

```bash
npm run local:reset
```

Resets the Supabase database to a clean state:
- Drops all tables and data
- Re-runs all migrations from `supabase/migrations/`
- Re-applies seed data

Useful when:
- Testing database migrations
- Need a fresh database state
- Troubleshooting schema issues

## Configuration

### Production vs Local

The project has two configuration files:

| File | Used By | Purpose |
|------|---------|---------|
| `data/config.json` | `go run . serve` | **Production** - Default dev server connects to production Supabase |
| `data/config.local.json` | `go run . local` | **Local** - Local stack uses local Supabase and Lambda |

This means:

- `npm run dev` → Connects to **production** Supabase
- `npm run local` → Connects to **local** Supabase and Lambda

### Environment Variables

The local stack passes environment variables to the Lambda container from `data/config.local.json`:

- `SUPABASE_URL` - Local Supabase API URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key for admin operations
- `ANTHROPIC_API_KEY` - Claude API key (for Claude Code functionality)
- `OPENAI_API_KEY` - OpenAI API key (for AI Chat features)
- `CLOUDFLARE_API_KEY` - Cloudflare API key (for browser rendering)
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `TMDB_API_KEY` - The Movie Database API key
- `DEEPGRAM_API_KEY` - Deepgram API key (for audio transcription)
- `MAPKIT_TEAM_ID`, `MAPKIT_KEY_ID`, `MAPKIT_PRIVATE_KEY` - Apple MapKit keys

### Lambda Docker Communication

The Lambda container accesses the local Supabase instance using `host.docker.internal`:

```
SUPABASE_URL=http://host.docker.internal:54321
```

This is automatically configured by the local stack. On macOS and Windows, `host.docker.internal` resolves to the host machine's localhost.

## Troubleshooting

### Docker Not Running

**Error**: `Docker check failed`

**Solution**: Start Docker Desktop before running `npm run local`.

### Port Already in Use

**Error**: `bind: address already in use`

**Solution**:
- Check if another process is using the port
- Stop existing Supabase: `npx supabase stop`
- Stop existing Lambda container: `docker stop lambda-local`

### Lambda Container Fails to Start

**Error**: `docker run failed`

**Solution**:
1. Check Docker is running
2. Rebuild the Lambda image: `cd lambda/function && npm run test:docker:build`
3. Check logs: `docker logs lambda-local`

### Supabase Won't Start

**Error**: `supabase start failed`

**Solution**:
1. Stop all Supabase services: `npx supabase stop`
2. Clear Docker volumes: `docker volume prune`
3. Restart Docker Desktop
4. Try again: `npm run local`

### Missing API Keys

**Error**: Lambda functions fail with authentication errors

**Solution**:
- Edit `data/config.local.json`
- Add your actual API keys (not placeholder values)
- Restart the local stack: `npm run local:stop && npm run local`

### Frontend Can't Connect to Supabase

**Issue**: App shows connection errors

**Solution**:
1. Check Supabase is running: `npx supabase status`
2. Verify frontend is using correct URL: http://localhost:54321
3. Check browser console for CORS errors
4. Restart the stack

## Development Workflow

### Typical Development Session

1. **Start local stack**:
   ```bash
   npm run local
   ```

2. **Make code changes** in your editor (VSCode, etc.)

3. **Test changes**:
   - Frontend hot-reloads automatically
   - Lambda requires restart: `npm run local:stop && npm run local`
   - Database changes: `npm run local:reset`

4. **Stop when done**:
   ```bash
   # Press Ctrl+C or:
   npm run local:stop
   ```

### Testing Database Migrations

1. Create migration file in `supabase/migrations/`:
   ```bash
   touch supabase/migrations/$(date +%Y%m%d%H%M%S)_my_migration.sql
   ```

2. Write your SQL in the migration file

3. Reset database to apply migration:
   ```bash
   npm run local:reset
   ```

4. Verify migration worked:
   - Open Supabase Studio: http://localhost:54323
   - Check tables, columns, indexes

5. If migration needs fixes:
   - Edit the migration file
   - Reset again: `npm run local:reset`
   - Repeat until perfect

### Testing Lambda Functions

1. Ensure Lambda container is running:
   ```bash
   docker ps | grep lambda-local
   ```

2. Make changes to Lambda code in `lambda/function/src/`

3. Rebuild and restart:
   ```bash
   npm run local:stop
   npm run local
   ```

4. Watch logs for errors:
   ```bash
   npm run local:logs
   ```

5. Test via frontend or direct invocation:
   ```bash
   curl -X POST http://localhost:9000/2015-03-31/functions/function/invocations \
     -H "Content-Type: application/json" \
     -d '{"action": "your-action", "payload": {}}'
   ```

## Architecture Details

### Service Startup Order

1. **Docker check** - Verifies Docker is running
2. **Supabase** - Starts all Supabase services (blocks until ready)
3. **Lambda** - Builds Docker image (if needed), starts container
4. **Frontend** - Starts Go dev server with local configuration

### Log Aggregation

The `go run . local` command streams logs from all three services with color-coding:

- **[Supabase]** - Blue - PostgreSQL, PostgREST, Auth logs
- **[Lambda]** - Green - Lambda function logs
- **[Frontend]** - Magenta - Go HTTP server logs

All logs are multiplexed to a single stdout stream for easy debugging.

### Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Host (macOS)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────┐  ┌────────────────────────────┐ │
│  │   Supabase (Docker)   │  │   Lambda (Docker)          │ │
│  │                       │  │                            │ │
│  │  Port 54321 (API)     │◄─┤  Access via:               │ │
│  │  Port 54322 (DB)      │  │  host.docker.internal:5432 │ │
│  │  Port 54323 (Studio)  │  │                            │ │
│  │  Port 54324 (Email)   │  │  Exposed: 9000:8080        │ │
│  └───────────────────────┘  └────────────────────────────┘ │
│           ▲                            ▲                    │
│           │                            │                    │
│  ┌────────┴────────────────────────────┴─────────────────┐ │
│  │         Frontend Dev Server (Go process)              │ │
│  │         Accesses: localhost:54321                     │ │
│  │         Exposed: localhost:3002                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
                       Browser connects to:
                       http://localhost:3002
```

## Best Practices

1. **Always use local stack for testing**
   - Test migrations locally before applying to production
   - Test Lambda changes locally before deploying
   - Catch issues early in development

2. **Keep production as default**
   - `npm run dev` → production (stable, reliable)
   - `npm run local` → local (testing, experimentation)
   - This prevents accidental local-only testing

3. **Reset database frequently**
   - After pulling new migrations
   - When testing database changes
   - To ensure clean state

4. **Check logs when troubleshooting**
   - Lambda logs show function execution details
   - Supabase logs show database queries and auth events
   - Frontend logs show HTTP requests and errors

5. **Stop stack when not in use**
   - Frees up system resources
   - Prevents port conflicts
   - Ensures clean startup next time

## Production Deployment

When you're ready to deploy changes tested locally:

1. **Stop local stack**:
   ```bash
   npm run local:stop
   ```

2. **Apply migrations to production** (via Supabase MCP or dashboard)

3. **Deploy Lambda** (if changed):
   ```bash
   cd lambda
   npm run up
   ```

4. **Deploy frontend** (if changed):
   ```bash
   npm run build
   npm run deploy
   ```

## Additional Resources

- [Supabase Local Development Docs](https://supabase.com/docs/guides/cli/local-development)
- [AWS Lambda Runtime Interface Emulator](https://github.com/aws/aws-lambda-runtime-interface-emulator)
- [Docker Documentation](https://docs.docker.com/)

## Getting Help

If you encounter issues not covered in this guide:

1. Check the error message in the logs
2. Search for similar issues in project documentation
3. Ask for help in the project's communication channel
4. Create an issue with detailed reproduction steps
