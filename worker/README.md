# Screenshot Worker

A Cloudflare Worker that takes website screenshots using browser rendering and uploads them to Supabase storage.

## Features

- Takes full-page screenshots of websites using Puppeteer
- Uploads screenshots to Supabase storage bucket
- Updates content database records with screenshot references
- Built with TypeScript and Cloudflare Workers

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure secrets for local development:**
   Create a `.dev.vars` file:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

3. **Create Supabase storage bucket:**
   Create a bucket named `content` in your Supabase project.

4. **Set production secret:**
   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   # Paste your service role key when prompted
   ```

5. **Deploy:**
   ```bash
   npm run deploy
   ```

## Usage

Send a POST request to the worker with:

```json
{
  "url": "https://misplaced.design/",
  "contentId": "uuid-here"
}
```

Response:
```json
{
  "success": true,
  "screenshot_url": "public/uuid-here.png"
}
```

## Development

```bash
npm run dev
```

## Configuration

The worker expects:
- A `content` bucket in Supabase storage
- A `content` table with `id` and `screenshot_url` columns
- Browser rendering enabled in Cloudflare Workers