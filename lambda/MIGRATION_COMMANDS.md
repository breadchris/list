# Edge Function → Lambda Migration Commands

## Current State (Before Compaction)

### Completed Files:
1. ✅ `function/src/types.ts` - All type definitions (181 lines)
2. ✅ `function/src/utils.ts` - URL extraction, SEO fetching, content type detection (150 lines)
3. ✅ `function/package.json` - Added dependencies: cloudflare, node-fetch

### Files to Create (Line ranges from `supabase/functions/content/index.ts`):

#### 1. `function/src/supabase-client.ts`
**Source:** Lines 212-220
**Commands:**
```bash
cd /Users/hacked/Documents/GitHub/list/lambda/function/src

cat > supabase-client.ts << 'EOF'
import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
EOF
```

#### 2. `function/src/openai-client.ts`
**Source:** Lines 528-690
**Find/Replace:**
- `Deno.env.get('OPENAI_API_KEY')` → `process.env.OPENAI_API_KEY`
- Add imports: `import type { OpenAIMessage, GeneratedContent, ContentItem } from './types.js';`

**Commands:**
```bash
# Extract lines 528-690 from Edge Function
sed -n '528,690p' ../../../supabase/functions/content/index.ts > openai-client.ts

# Replace Deno with Node
sed -i '' "s/Deno\.env\.get('OPENAI_API_KEY')/process.env.OPENAI_API_KEY/g" openai-client.ts

# Add imports at top
sed -i '' '1i\
import type { OpenAIMessage, GeneratedContent, ContentItem } from '\''./types.js'\'';\
' openai-client.ts

# Add exports
sed -i '' 's/^const tools =/export const tools =/g' openai-client.ts
sed -i '' 's/^function formatContentForContext/export function formatContentForContext/g' openai-client.ts
sed -i '' 's/^async function callOpenAI/export async function callOpenAI/g' openai-client.ts
```

#### 3. `function/src/cloudflare-client.ts`
**Source:** Lines 1244-1266 (fetchMarkdownFromCloudflare) + 1392-1441 (processScreenshotJob)
**Find/Replace:**
- `Deno.env.get('CLOUDFLARE_API_KEY')` → `process.env.CLOUDFLARE_API_KEY`
- `Deno.env.get('CLOUDFLARE_ACCOUNT_ID')` → `process.env.CLOUDFLARE_ACCOUNT_ID`

**Commands:**
```bash
cat > cloudflare-client.ts << 'EOF'
import Cloudflare from 'cloudflare';

export async function fetchMarkdownFromCloudflare(url: string): Promise<string> {
  try {
    const cloudflareApiKey = process.env.CLOUDFLARE_API_KEY;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!cloudflareApiKey || !accountId) {
      throw new Error('Missing required Cloudflare environment variables');
    }

    const client = new Cloudflare({
      apiToken: cloudflareApiKey,
    });

    const markdown = await client.browserRendering.markdown.create({
      account_id: accountId,
      url: url,
    });

    return markdown as string;
  } catch (error) {
    console.error(`Failed to fetch markdown for ${url}:`, error);
    throw error;
  }
}

export async function generateScreenshot(url: string): Promise<ArrayBuffer> {
  const cloudflareApiKey = process.env.CLOUDFLARE_API_KEY;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!cloudflareApiKey || !accountId) {
    throw new Error('Missing required Cloudflare environment variables');
  }

  const client = new Cloudflare({
    apiToken: cloudflareApiKey,
  });

  const screenshot = await client.browserRendering.screenshot.create({
    account_id: accountId,
    url: url,
    options: {
      full_page: true
    }
  });

  return screenshot as ArrayBuffer;
}
EOF
```

#### 4. `function/src/tmdb-client.ts`
**Source:** Lines 1715-1877
**Commands:**
```bash
# Extract TMDb function
sed -n '1715,1877p' ../../../supabase/functions/content/index.ts > tmdb-client.ts

# Replace Deno with Node
sed -i '' "s/Deno\.env\.get('TMDB_API_KEY')/process.env.TMDB_API_KEY/g" tmdb-client.ts

# Add imports
sed -i '' '1i\
import type { ContentItem, TMDbSearchResponse, TMDbMovie, TMDbTVShow } from '\''./types.js'\'';\
' tmdb-client.ts

# Export function
sed -i '' 's/^async function processTMDbSearchForContent/export async function processTMDbSearchForContent/g' tmdb-client.ts
```

#### 5. `function/src/content-handlers.ts`
**Source:** Multiple sections from Edge Function
**Key sections:**
- Lines 387-525: SEO handlers
- Lines 692-796: LLM handlers
- Lines 798-919: Chat handler
- Lines 921-1044: Claude Code handler (SKIP - already exists in index.ts)
- Lines 1268-1442: Markdown handlers
- Lines 1567-1686: YouTube handlers
- Lines 1690-1877: TMDb handlers

**Commands:**
```bash
cat > content-handlers.ts << 'EOF'
import type {
  ContentResponse,
  SEOExtractPayload,
  LLMGeneratePayload,
  ChatMessagePayload,
  MarkdownExtractPayload,
  YouTubePlaylistPayload,
  TMDbSearchPayload,
  ContentItem
} from './types.js';
import { extractUrls, extractYouTubePlaylistUrls, fetchSEOMetadata } from './utils.js';
import { callOpenAI, formatContentForContext } from './openai-client.js';
import { fetchMarkdownFromCloudflare } from './cloudflare-client.js';
import { processTMDbSearchForContent } from './tmdb-client.js';

// Copy handlers from Edge Function - will do this manually to save tokens
// Key handlers to port:
// - handleSEOExtract
// - processSEOForContent
// - handleLLMGenerate
// - handleChatMessage
// - handleMarkdownExtract
// - processMarkdownForContent
// - handleYouTubePlaylistExtract
// - processYouTubePlaylistForContent
// - handleTMDbSearch
EOF
```

**Manual extraction needed** - too large for sed, will create separately

#### 6. Update `function/src/index.ts`
**Add routing after line 137:**
```typescript
// Add action-based routing
const action = body.action as string;

switch (action) {
  case 'seo-extract':
    result = await handleSEOExtract(supabase, body.payload);
    break;
  case 'llm-generate':
    result = await handleLLMGenerate(supabase, body.payload);
    break;
  case 'markdown-extract':
    result = await handleMarkdownExtract(supabase, body.payload);
    break;
  case 'chat-message':
    result = await handleChatMessage(supabase, body.payload);
    break;
  case 'youtube-playlist-extract':
    result = await handleYouTubePlaylistExtract(supabase, body.payload);
    break;
  case 'tmdb-search':
    result = await handleTMDbSearch(supabase, body.payload);
    break;
  default:
    // Fall through to path-based routing
}
```

### Pulumi Updates

#### 7. Update `lambda/index.ts`
**Add environment variables (line ~120):**
```typescript
environment: {
  variables: {
    NODE_ENV: 'production',
    S3_BUCKET_NAME: sessionBucket.bucket,
    ANTHROPIC_API_KEY: anthropicApiKey,
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
    SUPABASE_URL: supabaseUrl,
    HOME: '/tmp',
    IS_SANDBOX: '1',

    // NEW - Add these
    OPENAI_API_KEY: config.requireSecret('openai_api_key'),
    CLOUDFLARE_API_KEY: config.requireSecret('cloudflare_api_key'),
    CLOUDFLARE_ACCOUNT_ID: config.require('cloudflare_account_id'),
    TMDB_API_KEY: config.requireSecret('tmdb_api_key'),
  }
}
```

**Add API routes (after line 172):**
```typescript
// SEO Extract route
const seoExtractRoute = new aws.apigatewayv2.Route('seo-extract-route', {
  apiId: api.id,
  routeKey: 'POST /seo-extract',
  target: pulumi.interpolate`integrations/${integration.id}`
});

// LLM Generate route
const llmGenerateRoute = new aws.apigatewayv2.Route('llm-generate-route', {
  apiId: api.id,
  routeKey: 'POST /llm-generate',
  target: pulumi.interpolate`integrations/${integration.id}`
});

// Markdown Extract route
const markdownExtractRoute = new aws.apigatewayv2.Route('markdown-extract-route', {
  apiId: api.id,
  routeKey: 'POST /markdown-extract',
  target: pulumi.interpolate`integrations/${integration.id}`
});

// Chat Message route
const chatMessageRoute = new aws.apigatewayv2.Route('chat-message-route', {
  apiId: api.id,
  routeKey: 'POST /chat-message',
  target: pulumi.interpolate`integrations/${integration.id}`
});

// YouTube Playlist Extract route
const youtubePlaylistRoute = new aws.apigatewayv2.Route('youtube-playlist-extract-route', {
  apiId: api.id,
  routeKey: 'POST /youtube-playlist-extract',
  target: pulumi.interpolate`integrations/${integration.id}`
});

// TMDb Search route
const tmdbSearchRoute = new aws.apigatewayv2.Route('tmdb-search-route', {
  apiId: api.id,
  routeKey: 'POST /tmdb-search',
  target: pulumi.interpolate`integrations/${integration.id}`
});
```

### Configure Secrets

```bash
cd /Users/hacked/Documents/GitHub/list/lambda
export PULUMI_CONFIG_PASSPHRASE=""

# Get values from Supabase secrets
OPENAI_KEY=$(cd .. && npx supabase secrets list | grep OPENAI_API_KEY)
CLOUDFLARE_KEY=$(cd .. && npx supabase secrets list | grep CLOUDFLARE_API_KEY)
CLOUDFLARE_ACCOUNT=$(cd .. && npx supabase secrets list | grep CLOUDFLARE_ACCOUNT_ID)
TMDB_KEY=$(cd .. && npx supabase secrets list | grep TMDB_API_KEY)

# Set in Pulumi (will need actual values)
pulumi config set --secret openai_api_key "sk-..."
pulumi config set --secret cloudflare_api_key "..."
pulumi config set cloudflare_account_id "b61180b9a24b012aa20ab5a105c606f5"
pulumi config set --secret tmdb_api_key "eyJ..."
```

### Frontend Updates

#### Create `components/LambdaClient.ts`:
```typescript
const LAMBDA_BASE_URL = 'https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com';

export async function callLambda(action: string, payload: any) {
  const response = await fetch(`${LAMBDA_BASE_URL}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Lambda error: ${response.status}`);
  }

  return await response.json();
}
```

### Testing Commands

```bash
# Build Docker image
cd function
docker build -t lambda-migration-test .

# Run with env vars
docker run -p 9000:8080 \
  -e ANTHROPIC_API_KEY="..." \
  -e OPENAI_API_KEY="..." \
  -e CLOUDFLARE_API_KEY="..." \
  -e CLOUDFLARE_ACCOUNT_ID="..." \
  -e TMDB_API_KEY="..." \
  -e SUPABASE_URL="https://zazsrepfnamdmibcyenx.supabase.co" \
  -e SUPABASE_SERVICE_ROLE_KEY="..." \
  -e S3_BUCKET_NAME="claude-code-sessions" \
  -e AWS_REGION="us-east-1" \
  lambda-migration-test

# Test endpoint
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d @test-seo-payload.json
```

## Critical Notes for Post-Compaction

1. **content-handlers.ts is the largest file** (~1300 lines) - needs manual extraction
2. **All handlers use same Supabase client** - import from supabase-client.ts
3. **Queue functions (pgmq) can be SKIPPED** - not needed in Lambda
4. **Screenshot handler can be SKIPPED initially** - requires S3 upload changes
5. **Main changes are just:** `Deno.env.get → process.env` and ESM imports → npm imports
