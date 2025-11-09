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
  // Use .asResponse() to get raw binary data without SDK parsing (which corrupts PNG bytes)
  const response = await client.browserRendering.screenshot.create({
    account_id: accountId,
    url: url,
    gotoOptions: {
      waitUntil: 'networkidle2',  // Wait until network is idle (≤2 connections for 500ms)
      timeout: 30000               // 30 second timeout for page load
    },
    viewport: { width: 1280, height: 720 },  // Consistent viewport size
    screenshotOptions: {
      fullPage: false  // Capture viewport only, not full scrollable page
    }
  }).asResponse();

  // Get the binary ArrayBuffer from the raw Response
  const screenshot = await response.arrayBuffer();

  return screenshot;
}
