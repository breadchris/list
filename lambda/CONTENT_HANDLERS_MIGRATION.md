# Content Handlers Migration Instructions

## Overview
The `content-handlers.ts` file is ~1300 lines and contains all business logic from the Edge Function.
This file can be created by copying specific line ranges and doing simple find/replace.

## Step-by-Step Instructions

### 1. Extract handler functions from Edge Function

```bash
cd /Users/hacked/Documents/GitHub/list/lambda/function/src

# Create base file with imports
cat > content-handlers.ts << 'EOF'
import type {
  ContentResponse,
  SEOExtractPayload,
  LLMGeneratePayload,
  ChatMessagePayload,
  MarkdownExtractPayload,
  YouTubePlaylistPayload,
  TMDbSearchPayload,
  ContentItem,
  OpenAIMessage
} from './types.js';
import { extractUrls, extractYouTubePlaylistUrls, fetchSEOMetadata } from './utils.js';
import { callOpenAI, callOpenAIChat, formatContentForContext } from './openai-client.js';
import { fetchMarkdownFromCloudflare } from './cloudflare-client.js';

EOF
```

### 2. Copy handler sections from Edge Function

**Source file:** `/Users/hacked/Documents/GitHub/list/supabase/functions/content/index.ts`

**Section 1: SEO Handlers** (Lines 387-525)
```bash
# Append SEO handlers
sed -n '387,525p' ../../../supabase/functions/content/index.ts >> content-handlers.ts

# Add export keywords
sed -i '' 's/^async function handleSEOExtract/export async function handleSEOExtract/g' content-handlers.ts
sed -i '' 's/^async function processSEOForContent/export async function processSEOForContent/g' content-handlers.ts
```

**Section 2: LLM Handlers** (Lines 692-796)
```bash
# Append LLM handlers
sed -n '692,796p' ../../../supabase/functions/content/index.ts >> content-handlers.ts

# Add export keywords
sed -i '' 's/^async function handleLLMGenerate/export async function handleLLMGenerate/g' content-handlers.ts
```

**Section 3: Chat Handler** (Lines 798-919)
```bash
# Append chat handler
sed -n '798,919p' ../../../supabase/functions/content/index.ts >> content-handlers.ts

# Add export keywords
sed -i '' 's/^async function handleChatMessage/export async function handleChatMessage/g' content-handlers.ts
```

**Section 4: Markdown Handlers** (Lines 1268-1442 in current, 1346-1443 in original)
```bash
# Append markdown handlers
sed -n '1346,1443p' ../../../supabase/functions/content/index.ts >> content-handlers.ts

# Add export keywords
sed -i '' 's/^async function handleMarkdownExtract/export async function handleMarkdownExtract/g' content-handlers.ts
sed -i '' 's/^async function processMarkdownForContent/export async function processMarkdownForContent/g' content-handlers.ts
```

**Section 5: YouTube Handlers** (Lines 1647-1760)
```bash
# Append YouTube handlers
sed -n '1647,1760p' ../../../supabase/functions/content/index.ts >> content-handlers.ts

# Add export keywords
sed -i '' 's/^async function handleYouTubePlaylistExtract/export async function handleYouTubePlaylistExtract/g' content-handlers.ts
sed -i '' 's/^async function processYouTubePlaylistForContent/export async function processYouTubePlaylistForContent/g' content-handlers.ts
```

**Section 6: TMDb Handler** (Lines 1690-1877)
```bash
# Append TMDb handler
sed -n '1690,1877p' ../../../supabase/functions/content/index.ts >> content-handlers.ts

# Add export keywords
sed -i '' 's/^async function handleTMDbSearch/export async function handleTMDbSearch/g' content-handlers.ts
sed -i '' 's/^async function processTMDbSearchForContent/export async function processTMDbSearchForContent/g' content-handlers.ts
```

### 3. Global find/replace operations

```bash
# Replace all Deno.env.get calls (shouldn't be any left, but just in case)
sed -i '' "s/Deno\.env\.get('OPENAI_API_KEY')/process.env.OPENAI_API_KEY/g" content-handlers.ts

# Remove imports that were in Edge Function (already in our imports)
sed -i '' '/^import.*from.*https:\/\/esm.sh/d' content-handlers.ts
```

### 4. Add TMDb search function

The TMDb handler calls `processTMDbSearchForContent` which needs to be either:
- Imported from `tmdb-client.ts` (recommended)
- Included inline in content-handlers.ts

**Option A (recommended):** Add import at top:
```typescript
import { processTMDbSearchForContent } from './tmdb-client.js';
```

**Option B:** Copy the function into content-handlers.ts

### 5. Handle special cases

**callOpenAI import:**
The handlers call `callOpenAI()` and `formatContentForContext()` - these are already imported from `openai-client.ts`.

**Chat handler calls:**
The chat handler calls `callOpenAIChat()` - already imported.

**Lambda endpoint reference:**
In `processYouTubePlaylistForContent`, there's a hardcoded Lambda URL:
```javascript
await fetch('https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/youtube/playlist'
```
This is correct - Lambda calling itself via API Gateway (keep as-is).

## Key Differences from Edge Function

1. **No queue functions** - Skip `handleQueueProcess`, `enqueueJob`, etc. (not needed in Lambda)
2. **No screenshot handler in content-handlers** - Screenshot logic uses S3, handle separately
3. **Supabase client** - Passed as parameter, not created in each function
4. **OpenAI calls** - Imported from `openai-client.ts`
5. **Environment variables** - `process.env.X` instead of `Deno.env.get('X')`

## Verification Checklist

After creating content-handlers.ts, verify:

- [ ] All functions exported (have `export` keyword)
- [ ] All imports at top reference local modules (.js extension)
- [ ] No `Deno.env.get` calls remaining
- [ ] No ESM.sh imports remaining
- [ ] Functions that call OpenAI use imported `callOpenAI()` or `callOpenAIChat()`
- [ ] Functions that use Supabase accept `supabase` parameter
- [ ] YouTube handler has correct Lambda endpoint URL

## Testing

After creating the file, test TypeScript compilation:
```bash
cd /Users/hacked/Documents/GitHub/list/lambda/function
npx tsc --noEmit
```

Fix any import errors before deploying.
