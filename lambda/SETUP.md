# Lambda Migration Setup

## Required Pulumi Secrets

After migrating all Edge Function logic to Lambda, you need to configure these secrets:

```bash
cd /Users/hacked/Documents/GitHub/list/lambda

# Already configured:
# - pulumi config set --secret anthropic_api_key <key>
# - pulumi config set --secret supabase_service_role_key <key>
# - pulumi config set supabase_url https://zazsrepfnamdmibcyenx.supabase.co

# New secrets needed:
pulumi config set --secret openai_api_key <your_openai_api_key>
pulumi config set --secret cloudflare_api_key <your_cloudflare_api_token>
pulumi config set cloudflare_account_id <your_cloudflare_account_id>
pulumi config set --secret tmdb_api_key <your_tmdb_bearer_token>
```

## Getting API Keys

### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy the key (starts with `sk-proj-...`)

### Cloudflare API Token
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create token with "Browser Rendering" template or permissions
3. Copy the token

### Cloudflare Account ID
1. Go to any Cloudflare zone dashboard
2. Scroll down to "Account ID" on right sidebar
3. Copy the account ID

### TMDb API Key
1. Go to https://www.themoviedb.org/settings/api
2. Request API key (Free tier is fine)
3. Use the "API Read Access Token" (Bearer token)

## Deploy

Once all secrets are configured:

```bash
# Build and deploy
pulumi up

# Verify deployment
curl -X POST https://<api-gateway-url>/content \
  -H "Content-Type: application/json" \
  -d '{"action": "seo-extract", "payload": {"selectedContent": [{"id": "test", "data": "https://example.com", "type": "text", "group_id": "test", "user_id": "test"}]}}'
```

## Migration Checklist

- [x] Created all handler files (types, utils, clients, handlers)
- [x] Added routing to function/src/index.ts
- [x] Updated Pulumi config (lambda/index.ts)
- [ ] Set all required Pulumi secrets
- [ ] Run `pulumi up` to deploy
- [ ] Test /content endpoint
- [ ] Update frontend to call Lambda instead of Edge Function
- [ ] Remove/deprecate Edge Function

## Environment Variables Set in Lambda

The following environment variables are automatically set by Pulumi:

- `NODE_ENV=production`
- `S3_BUCKET_NAME` - For Claude Code sessions
- `ANTHROPIC_API_KEY` - For Claude Code
- `SUPABASE_SERVICE_ROLE_KEY` - For database access
- `SUPABASE_URL` - Supabase project URL
- `OPENAI_API_KEY` - For LLM generation and chat
- `CLOUDFLARE_API_KEY` - For browser rendering (markdown, screenshots)
- `CLOUDFLARE_ACCOUNT_ID` - For Cloudflare API calls
- `TMDB_API_KEY` - For TMDb search functionality
- `HOME=/tmp` - For Claude CLI
- `IS_SANDBOX=1` - For Claude CLI bypass permissions

## API Routes

All routes are on the same Lambda function via API Gateway:

- `POST /claude-code` - Claude Code execution
- `POST /youtube/playlist` - YouTube playlist extraction
- `POST /content` - Content handlers (SEO, LLM, chat, markdown, TMDb)

### Content Handler Actions

The `/content` endpoint accepts these actions:

```typescript
{
  "action": "seo-extract" | "llm-generate" | "chat-message" | "markdown-extract" | "youtube-playlist-extract" | "tmdb-search",
  "payload": { /* action-specific payload */ }
}
```
