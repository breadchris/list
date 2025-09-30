import puppeteer from '@cloudflare/puppeteer';
import { createClient } from '@supabase/supabase-js';

export interface Env {
	BROWSER: Fetcher;
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
}

interface ScreenshotRequest {
	url: string;
	contentId: string;
}

interface ScreenshotResponse {
	success: boolean;
	screenshot_url?: string;
	error?: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// CORS headers for all responses
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Max-Age': '86400',
		};

		// Handle preflight OPTIONS request
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders
			});
		}

		try {
			// Only handle POST requests
			if (request.method !== 'POST') {
				return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
					status: 405,
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders
					}
				});
			}

			// Parse request body
			const body: ScreenshotRequest = await request.json();
			const { url, contentId } = body;

			if (!url || !contentId) {
				return new Response(JSON.stringify({
					success: false,
					error: 'Missing required parameters: url and contentId'
				}), {
					status: 400,
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders
					}
				});
			}

			// Validate URL
			try {
				new URL(url);
			} catch {
				return new Response(JSON.stringify({
					success: false,
					error: 'Invalid URL provided'
				}), {
					status: 400,
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders
					}
				});
			}

			// Launch browser
			const browser = await puppeteer.launch(env.BROWSER);
			const page = await browser.newPage();

			try {
				// Set viewport for Pinterest-like card display
				// Using 1200x900 viewport, capturing 1200x630 for optimal card aspect ratio
				await page.setViewport({ width: 1200, height: 900 });

				// Navigate to the URL and wait for content to load
				await page.goto(url, {
					waitUntil: 'networkidle0',
					timeout: 30000
				});

				// Take screenshot with fixed dimensions for card display
				// 1200x630 gives us a 1.9:1 aspect ratio (similar to Open Graph images)
				const screenshotBuffer = await page.screenshot({
					type: 'png',
					fullPage: false,  // Only capture viewport, not full page
					clip: {
						x: 0,
						y: 0,
						width: 1200,
						height: 630
					}
				});

				// Initialize Supabase client with service role key
				const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

				// Upload to Supabase storage
				const fileName = `${contentId}.png`;
				const filePath = `public/${fileName}`;

				const { data: uploadData, error: uploadError } = await supabase.storage
					.from('content')
					.upload(filePath, screenshotBuffer, {
						cacheControl: '3600',
						contentType: 'image/png',
						upsert: true
					});

				if (uploadError) {
					throw new Error(`Upload failed: ${uploadError.message}`);
				}

				// Update content record with screenshot reference
				const { error: updateError } = await supabase
					.from('content')
					.update({ screenshot_url: filePath })
					.eq('id', contentId);

				if (updateError) {
					console.warn(`Database update failed: ${updateError.message}`);
					// Don't fail the request if database update fails, screenshot is still saved
				}

				await browser.close();

				const response: ScreenshotResponse = {
					success: true,
					screenshot_url: filePath
				};

				return new Response(JSON.stringify(response), {
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders
					}
				});

			} catch (error) {
				await browser.close();
				throw error;
			}

		} catch (error) {
			console.error('Screenshot worker error:', error);

			const response: ScreenshotResponse = {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			};

			return new Response(JSON.stringify(response), {
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders
				}
			});
		}
	}
};