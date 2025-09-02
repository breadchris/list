import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SEOMetadata {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  domain?: string;
  siteName?: string;
  type?: string;
  url?: string;
}

interface ContentRow {
  id: string;
  type: string;
  data: string;
  group_id: string;
  user_id: string;
  parent_content_id: string | null;
  metadata?: any;
}

// URL extraction regex
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

// Extract URLs from text content
function extractUrls(text: string): string[] {
  const urls = text.match(URL_REGEX) || [];
  return [...new Set(urls)]; // Remove duplicates
}

// Fetch SEO metadata from a URL
async function fetchSEOMetadata(url: string): Promise<SEOMetadata> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ListApp-SEO-Bot/1.0)',
      },
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const metadata: SEOMetadata = {
      url: url,
      domain: new URL(url).hostname,
    };

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
                     html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
    if (descMatch) {
      metadata.description = descMatch[1].trim();
    }

    // Extract Open Graph data
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    if (ogTitle && !metadata.title) {
      metadata.title = ogTitle[1].trim();
    }

    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    if (ogDesc && !metadata.description) {
      metadata.description = ogDesc[1].trim();
    }

    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    if (ogImage) {
      metadata.image = ogImage[1].trim();
      // Convert relative URLs to absolute
      if (metadata.image && !metadata.image.startsWith('http')) {
        metadata.image = new URL(metadata.image, url).toString();
      }
    }

    const ogSiteName = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    if (ogSiteName) {
      metadata.siteName = ogSiteName[1].trim();
    }

    const ogType = html.match(/<meta[^>]*property=["']og:type["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    if (ogType) {
      metadata.type = ogType[1].trim();
    }

    // Extract favicon
    const faviconMatch = html.match(/<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i);
    if (faviconMatch) {
      metadata.favicon = faviconMatch[1].trim();
      // Convert relative URLs to absolute
      if (metadata.favicon && !metadata.favicon.startsWith('http')) {
        metadata.favicon = new URL(metadata.favicon, url).toString();
      }
    }

    return metadata;
  } catch (error) {
    console.error(`Failed to fetch SEO for ${url}:`, error);
    // Return minimal metadata on error
    return {
      url: url,
      domain: new URL(url).hostname,
      title: url, // Fallback to URL as title
    };
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: corsHeaders
      });
    }

    // Get request body
    const { content_id } = await req.json();
    if (!content_id) {
      return new Response('Missing content_id', { 
        status: 400,
        headers: corsHeaders
      });
    }

    // Get auth token from request headers
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return new Response('Missing authorization header', { 
        status: 401,
        headers: corsHeaders
      });
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    });

    // Get the content
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('*')
      .eq('id', content_id)
      .single();

    if (contentError || !content) {
      return new Response('Content not found', { 
        status: 404,
        headers: corsHeaders
      });
    }

    const contentRow = content as ContentRow;

    // Extract URLs from content data
    const urls = extractUrls(contentRow.data);
    
    if (urls.length === 0) {
      return new Response(JSON.stringify({
        message: 'No URLs found in content',
        seo_children: [],
        urls_processed: 0
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        },
      });
    }

    const seoChildren: ContentRow[] = [];
    let urlsProcessed = 0;

    // Process each URL
    for (const url of urls) {
      try {
        // Check if SEO content already exists for this URL
        const { data: existingSEO, error: seoError } = await supabase
          .rpc('find_seo_content_by_url', {
            parent_id: content_id,
            url: url
          });

        if (seoError) {
          console.error('Error checking existing SEO:', seoError);
          continue;
        }

        if (existingSEO) {
          // Get the existing SEO content
          const { data: existingContent } = await supabase
            .from('content')
            .select('*')
            .eq('id', existingSEO)
            .single();

          if (existingContent) {
            seoChildren.push(existingContent as ContentRow);
            urlsProcessed++;
            continue;
          }
        }

        // Fetch SEO metadata for the URL
        const seoMetadata = await fetchSEOMetadata(url);

        // Create or update SEO content
        const { data: seoContentId, error: upsertError } = await supabase
          .rpc('upsert_seo_content', {
            parent_id: content_id,
            user_id: contentRow.user_id,
            group_id: contentRow.group_id,
            url: url,
            seo_metadata: seoMetadata
          });

        if (upsertError) {
          console.error('Error upserting SEO content:', upsertError);
          continue;
        }

        // Get the created/updated SEO content
        const { data: seoContent } = await supabase
          .from('content')
          .select('*')
          .eq('id', seoContentId)
          .single();

        if (seoContent) {
          seoChildren.push(seoContent as ContentRow);
        }

        urlsProcessed++;
      } catch (error) {
        console.error(`Error processing URL ${url}:`, error);
        continue;
      }
    }

    return new Response(JSON.stringify({
      message: `Processed ${urlsProcessed} URLs from content`,
      seo_children: seoChildren,
      urls_processed: urlsProcessed,
      total_urls_found: urls.length
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      },
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      },
    });
  }
});