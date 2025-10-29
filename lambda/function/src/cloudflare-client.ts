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

  // Generate screenshot with wait parameters to ensure page loads fully
  const screenshot = await client.browserRendering.screenshot.create({
    account_id: accountId,
    url: url,
    goto_options: {
      wait_until: 'networkidle2',  // Wait until network is idle (≤2 connections for 500ms)
      timeout: 30000                // 30 second timeout for page load
    },
    options: {
      viewport: { width: 1280, height: 720 },  // Consistent viewport size
      full_page: false                          // Capture viewport only, not full scrollable page
    }
  });

  return screenshot as unknown as ArrayBuffer;
}
