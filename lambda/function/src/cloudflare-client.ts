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

  // Type cast to any to bypass SDK type checking - runtime API supports full_page
  const screenshot = await (client.browserRendering.screenshot.create as any)({
    account_id: accountId,
    url: url,
    full_page: true
  });

  return screenshot as unknown as ArrayBuffer;
}
