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
