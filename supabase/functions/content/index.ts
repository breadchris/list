import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Cloudflare from 'https://esm.sh/cloudflare@5'

// =============================================================================
// TYPES
// =============================================================================

interface ContentQueueJob {
  action: 'seo-extract' | 'llm-generate' | 'screenshot-process';
  payload: any;
  userId: string;
  priority?: number;
  retries?: number;
  createdAt: string;
}

interface ContentRequest {
  action: 'seo-extract' | 'llm-generate' | 'screenshot-queue' | 'queue-process' | 'markdown-extract' | 'chat-message' | 'claude-code-execute' | 'youtube-playlist-extract' | 'tmdb-search';
  payload: any;
  useQueue?: boolean;
}

interface ContentResponse {
  success: boolean;
  data?: any;
  error?: string;
  queued?: boolean;
}

// SEO Types
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

interface SEOExtractPayload {
  selectedContent: ContentItem[];
  onProgress?: (item: any) => void;
}

// LLM Types
interface ContentItem {
  id: string;
  type: string;
  data: string;
  group_id: string;
  user_id: string;
  parent_content_id: string | null;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

interface LLMGeneratePayload {
  system_prompt: string;
  selected_content: ContentItem[];
  group_id: string;
  parent_content_id?: string | null;
}

interface GeneratedContent {
  type: string;
  data: string;
}

// Screenshot Types
interface ScreenshotQueuePayload {
  jobs: Array<{
    contentId: string;
    url: string;
  }>;
}

interface ScreenshotProcessPayload {
  contentId: string;
  url: string;
}

// Markdown Types
interface MarkdownExtractPayload {
  selectedContent: ContentItem[];
}

interface MarkdownMetadata {
  source_url: string;
  extracted_at: string;
  cloudflare_markdown: boolean;
}

// Chat Types
interface ChatMessagePayload {
  chat_content_id: string;
  message: string;
  group_id: string;
}

// Claude Code Types
interface ClaudeCodeExecutePayload {
  selected_content: ContentItem[];
  group_id: string;
  parent_content_id?: string | null;
}

// YouTube Playlist Types
interface YouTubePlaylistPayload {
  selectedContent: ContentItem[];
}

interface YouTubeThumbnail {
  url: string;
  width: number;
  height: number;
}

interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
  duration: number;
  author: string;
  channel_id: string;
  channel_handle: string;
  description: string;
  views: number;
  publish_date: string;
  thumbnails: YouTubeThumbnail[];
}

// TMDb Types
interface TMDbSearchPayload {
  selectedContent: ContentItem[];
  searchType?: 'movie' | 'tv' | 'multi';  // defaults to 'multi'
  mode: 'search-only' | 'add-selected';  // search-only: return results, add-selected: create content
  selectedResults?: number[];  // TMDb IDs to add (for add-selected mode)
}

interface TMDbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
  adult: boolean;
  media_type?: string;
}

interface TMDbTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
  media_type?: string;
}

interface TMDbSearchResponse {
  page: number;
  results: (TMDbMovie | TMDbTVShow)[];
  total_pages: number;
  total_results: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Authorization header is required')
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Parse request
    const requestData: ContentRequest = await req.json()
    const { action, payload, useQueue = false } = requestData

    console.log(`Processing action: ${action}`, { useQueue })

    // Route to appropriate handler
    let response: ContentResponse

    switch (action) {
      case 'seo-extract':
        response = await handleSEOExtract(supabase, payload as SEOExtractPayload, useQueue)
        break
      case 'llm-generate':
        response = await handleLLMGenerate(supabase, payload as LLMGeneratePayload, useQueue)
        break
      case 'screenshot-queue':
        response = await handleScreenshotQueue(supabase, payload as ScreenshotQueuePayload, authHeader)
        break
      case 'queue-process':
        response = await handleQueueProcess(supabase)
        break
      case 'markdown-extract':
        response = await handleMarkdownExtract(supabase, payload as MarkdownExtractPayload)
        break
      case 'chat-message':
        response = await handleChatMessage(supabase, payload as ChatMessagePayload)
        break
      case 'claude-code-execute':
        response = await handleClaudeCodeExecute(supabase, payload as ClaudeCodeExecutePayload)
        break
      case 'youtube-playlist-extract':
        response = await handleYouTubePlaylistExtract(supabase, payload as YouTubePlaylistPayload)
        break
      case 'tmdb-search':
        response = await handleTMDbSearch(supabase, payload as TMDbSearchPayload)
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Error in content function:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// Extract URLs from text content
function extractUrls(text: string): string[] {
  const urls = text.match(URL_REGEX) || [];
  return [...new Set(urls)]; // Remove duplicates
}

// Extract YouTube playlist URLs from text
function extractYouTubePlaylistUrls(text: string): string[] {
  const playlistRegex = /https?:\/\/(?:www\.)?youtube\.com\/(?:watch\?.*list=|playlist\?list=)([\w-]+)/gi;
  const matches = text.matchAll(playlistRegex);
  return Array.from(matches, m => m[0]);
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

// =============================================================================
// HANDLERS
// =============================================================================

async function handleSEOExtract(supabase: any, payload: SEOExtractPayload, useQueue: boolean): Promise<ContentResponse> {
  if (useQueue) {
    // Queue the job for async processing
    await enqueueJob(supabase, {
      action: 'seo-extract',
      payload,
      userId: 'system', // Will be replaced with actual user ID from auth
      createdAt: new Date().toISOString()
    })

    return {
      success: true,
      queued: true,
      data: { message: 'SEO extraction queued for processing' }
    }
  }

  // Process immediately
  const results = []

  for (const contentItem of payload.selectedContent) {
    try {
      const result = await processSEOForContent(supabase, contentItem)
      results.push(result)
    } catch (error) {
      console.error(`Error processing SEO for content ${contentItem.id}:`, error)
      results.push({
        content_id: contentItem.id,
        success: false,
        error: error.message,
        total_urls_found: 0,
        urls_processed: 0,
        seo_children: []
      })
    }
  }

  return {
    success: true,
    data: results
  }
}

async function processSEOForContent(supabase: any, contentItem: ContentItem) {
  // Extract URLs from content data
  const urls = extractUrls(contentItem.data);

  if (urls.length === 0) {
    return {
      content_id: contentItem.id,
      success: true,
      total_urls_found: 0,
      urls_processed: 0,
      seo_children: []
    }
  }

  const seoChildren: ContentItem[] = [];
  let urlsProcessed = 0;
  const errors: string[] = [];

  // Process each URL
  for (const url of urls) {
    try {
      // Check if SEO content already exists for this URL
      const { data: existingSEO, error: seoError } = await supabase
        .rpc('find_seo_content_by_url', {
          parent_id: contentItem.id,
          url: url
        });

      if (seoError) {
        console.error('Error checking existing SEO:', seoError);
        errors.push(`Error checking existing SEO for ${url}: ${seoError.message}`)
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
          seoChildren.push(existingContent as ContentItem);
          urlsProcessed++;
          continue;
        }
      }

      // Fetch SEO metadata for the URL
      const seoMetadata = await fetchSEOMetadata(url);

      // Create or update SEO content
      const { data: seoContentId, error: upsertError } = await supabase
        .rpc('upsert_seo_content', {
          parent_id: contentItem.id,
          user_id: contentItem.user_id,
          group_id: contentItem.group_id,
          url: url,
          seo_metadata: seoMetadata
        });

      if (upsertError) {
        console.error('Error creating SEO content:', upsertError);
        errors.push(`Error creating SEO content for ${url}: ${upsertError.message}`)
        continue;
      }

      // Get the created content
      const { data: newSEOContent } = await supabase
        .from('content')
        .select('*')
        .eq('id', seoContentId)
        .single();

      if (newSEOContent) {
        seoChildren.push(newSEOContent as ContentItem);
      }

      urlsProcessed++;

    } catch (error) {
      console.error(`Error processing URL ${url}:`, error);
      errors.push(`Error processing ${url}: ${error.message}`)
    }
  }

  return {
    content_id: contentItem.id,
    success: errors.length === 0,
    total_urls_found: urls.length,
    urls_processed: urlsProcessed,
    seo_children: seoChildren,
    errors: errors.length > 0 ? errors : undefined
  }
}

// OpenAI types and tool definitions for LLM generation
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

const tools = [
  {
    type: "function",
    function: {
      name: "createContent",
      description: "Create new content items based on the analysis and processing of the selected content",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "Array of content items to create",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["text", "js"],
                  description: "Type of content to create"
                },
                data: {
                  type: "string",
                  description: "The content data/text"
                }
              },
              required: ["type", "data"]
            }
          }
        },
        required: ["items"]
      }
    }
  }
] as const;

// Format selected content for LLM context
function formatContentForContext(selectedContent: ContentItem[]): string {
  return selectedContent.map((item, index) => {
    const metadata = item.metadata ? `\nMetadata: ${JSON.stringify(item.metadata, null, 2)}` : '';
    return `Content Item ${index + 1}:
Type: ${item.type}
Data: ${item.data}${metadata}
Created: ${item.created_at}`;
  }).join('\n\n---\n\n');
}

// Call OpenAI API with tool calling
async function callOpenAI(systemPrompt: string, userContent: string): Promise<GeneratedContent[]> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const messages: OpenAIMessage[] = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: `Here is the content to process:\n\n${userContent}`
    }
  ];

  // Initial API call
  let response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: messages,
      tools: tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
  }

  let result = await response.json();

  // Handle tool calls
  while (result.choices?.[0]?.message?.tool_calls) {
    const toolCalls = result.choices[0].message.tool_calls;

    // Add assistant message with tool calls to conversation
    messages.push({
      role: 'assistant',
      content: result.choices[0].message.content || '',
      tool_calls: toolCalls
    });

    // Process each tool call
    for (const toolCall of toolCalls) {
      if (toolCall.function.name === 'createContent') {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const toolResult = {
            success: true,
            items_to_create: args.items?.length || 0
          };

          // Add tool response to conversation
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });

          // Return the generated content items
          return args.items || [];
        } catch (error) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: 'Failed to parse tool arguments' })
          });
        }
      }
    }

    // Continue conversation with tool results
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    result = await response.json();
  }

  // If no tool calls were made, return empty array
  return [];
}

async function handleLLMGenerate(supabase: any, payload: LLMGeneratePayload, useQueue: boolean): Promise<ContentResponse> {
  if (useQueue) {
    // Queue the job for async processing
    await enqueueJob(supabase, {
      action: 'llm-generate',
      payload,
      userId: 'system', // Will be replaced with actual user ID from auth
      createdAt: new Date().toISOString()
    })

    return {
      success: true,
      queued: true,
      data: { message: 'LLM generation queued for processing' }
    }
  }

  // Process immediately
  const { system_prompt, selected_content, group_id, parent_content_id } = payload;

  if (!system_prompt || !selected_content || !Array.isArray(selected_content) || selected_content.length === 0) {
    return {
      success: false,
      error: 'Missing or invalid required fields: system_prompt, selected_content'
    }
  }

  // For immediate processing, we need a user_id - get it from the first content item
  const user_id = selected_content[0]?.user_id;
  if (!user_id) {
    return {
      success: false,
      error: 'Unable to determine user_id from selected content'
    }
  }

  // Format content for LLM context
  const formattedContent = formatContentForContext(selected_content);

  // Call OpenAI API
  const generatedContent = await callOpenAI(system_prompt, formattedContent);

  if (!generatedContent || generatedContent.length === 0) {
    return {
      success: false,
      error: 'No content was generated by the LLM'
    }
  }

  // Create the prompt content item first
  const { data: promptContent, error: promptError } = await supabase
    .from('content')
    .insert({
      type: 'prompt',
      data: system_prompt,
      group_id: group_id,
      user_id: user_id,
      parent_content_id: parent_content_id,
      metadata: {
        selected_content_ids: selected_content.map(c => c.id),
        generated_count: generatedContent.length,
        created_by_llm: true
      }
    })
    .select()
    .single();

  if (promptError) {
    throw new Error(`Failed to create prompt content: ${promptError.message}`);
  }

  // Create the generated content items as children of the prompt
  const contentToInsert = generatedContent.map(item => ({
    type: item.type,
    data: item.data,
    group_id: group_id,
    user_id: user_id,
    parent_content_id: promptContent.id,
    metadata: {
      generated_by_llm: true,
      prompt_content_id: promptContent.id,
      source_content_ids: selected_content.map(c => c.id)
    }
  }));

  const { data: createdContent, error: createError } = await supabase
    .from('content')
    .insert(contentToInsert)
    .select();

  if (createError) {
    // If content creation fails, try to delete the prompt to avoid orphaned prompts
    await supabase.from('content').delete().eq('id', promptContent.id);
    throw new Error(`Failed to create generated content: ${createError.message}`);
  }

  return {
    success: true,
    data: {
      generated_content: generatedContent,
      prompt_content_id: promptContent.id,
      created_content: createdContent
    }
  }
}

async function handleChatMessage(supabase: any, payload: ChatMessagePayload): Promise<ContentResponse> {
  const { chat_content_id, message, group_id } = payload;

  // Validate payload
  if (!chat_content_id || !message || !group_id) {
    return {
      success: false,
      error: 'Missing required fields: chat_content_id, message, group_id'
    }
  }

  // 1. Get the chat content to verify it exists and get user_id
  const { data: chatContent, error: chatError } = await supabase
    .from('content')
    .select('*')
    .eq('id', chat_content_id)
    .eq('type', 'chat')
    .single();

  if (chatError || !chatContent) {
    return {
      success: false,
      error: 'Chat not found or invalid chat_content_id'
    }
  }

  const user_id = chatContent.user_id;

  // 2. Get conversation history (all children of chat, ordered by creation)
  const { data: conversationHistory, error: historyError } = await supabase
    .from('content')
    .select('*')
    .eq('parent_content_id', chat_content_id)
    .order('created_at', { ascending: true });

  if (historyError) {
    return {
      success: false,
      error: `Failed to load conversation history: ${historyError.message}`
    }
  }

  // 3. Build OpenAI messages array from conversation history
  const openAIMessages: OpenAIMessage[] = (conversationHistory || []).map(msg => ({
    role: msg.metadata?.role === 'assistant' ? 'assistant' : 'user',
    content: msg.data
  }));

  // 4. Call OpenAI chat completion
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    return {
      success: false,
      error: 'OpenAI API key not configured'
    }
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: openAIMessages,
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    return {
      success: false,
      error: `OpenAI API error: ${response.status} - ${errorData}`
    }
  }

  const result = await response.json();
  const assistantMessage = result.choices[0]?.message?.content;

  if (!assistantMessage) {
    return {
      success: false,
      error: 'No response from OpenAI'
    }
  }

  // 5. Create assistant response as child of chat
  const { data: assistantContent, error: assistantError } = await supabase
    .from('content')
    .insert({
      type: 'text',
      data: assistantMessage,
      group_id: group_id,
      user_id: user_id,
      parent_content_id: chat_content_id,
      metadata: {
        role: 'assistant',
        model: 'gpt-4',
        created_by_chat: true
      }
    })
    .select()
    .single();

  if (assistantError) {
    return {
      success: false,
      error: `Failed to create assistant message: ${assistantError.message}`
    }
  }

  return {
    success: true,
    data: {
      assistant_message: assistantMessage,
      assistant_content_id: assistantContent.id
    }
  }
}

// Helper function to detect content type from filename
function detectContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const typeMap: Record<string, string> = {
    'js': 'js',
    'jsx': 'js',
    'ts': 'js',
    'tsx': 'js',
    'py': 'code',
    'go': 'code',
    'rs': 'code',
    'java': 'code',
    'md': 'text',
    'txt': 'text',
    'json': 'code',
    'html': 'code',
    'css': 'code',
    'sql': 'code'
  };

  return typeMap[ext] || 'text';
}

// Helper function to download session files from S3
async function downloadSessionFromS3(sessionId: string): Promise<Array<{path: string, content: Uint8Array}>> {
  const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID');
  const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  const AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1';
  const S3_BUCKET_NAME = Deno.env.get('S3_BUCKET_NAME') || 'claude-code-sessions';

  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials not configured');
  }

  // Import AWS SDK and JSZip dynamically
  const { S3Client, GetObjectCommand } = await import('https://esm.sh/@aws-sdk/client-s3@3');
  const JSZip = (await import('https://esm.sh/jszip@3')).default;

  const s3 = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY
    }
  });

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: `${sessionId}.zip`
  });

  const response = await s3.send(command);

  if (!response.Body) {
    throw new Error(`Session ${sessionId} not found in S3`);
  }

  // Convert stream to array buffer
  const zipData = await response.Body.transformToByteArray();

  // Load and extract ZIP
  const zip = await JSZip.loadAsync(zipData);
  const files: Array<{path: string, content: Uint8Array}> = [];

  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (!zipEntry.dir) {
      const content = await zipEntry.async('uint8array');
      files.push({
        path: relativePath,
        content: content
      });
    }
  }

  return files;
}

async function handleClaudeCodeExecute(supabase: any, payload: ClaudeCodeExecutePayload): Promise<ContentResponse> {
  const { selected_content, group_id, parent_content_id } = payload;

  // Validate payload
  if (!selected_content || !Array.isArray(selected_content) || selected_content.length === 0) {
    return {
      success: false,
      error: 'Missing or invalid selected_content'
    }
  }

  if (!group_id) {
    return {
      success: false,
      error: 'Missing group_id'
    }
  }

  const user_id = selected_content[0]?.user_id;
  if (!user_id) {
    return {
      success: false,
      error: 'Unable to determine user_id from selected content'
    }
  }

  // Format content as prompt for Claude Code
  const promptParts = selected_content.map((item, index) => {
    return `Content ${index + 1}:\n${item.data}`;
  });
  const prompt = promptParts.join('\n\n---\n\n');

  // Call Lambda endpoint
  const lambdaEndpoint = Deno.env.get('LAMBDA_ENDPOINT') || 'https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/claude-code';

  const lambdaResponse = await fetch(lambdaEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt
    })
  });

  if (!lambdaResponse.ok) {
    const errorText = await lambdaResponse.text();
    return {
      success: false,
      error: `Lambda error: ${lambdaResponse.status} - ${errorText}`
    }
  }

  const lambdaResult = await lambdaResponse.json();

  if (!lambdaResult.success) {
    return {
      success: false,
      error: lambdaResult.error || 'Claude Code execution failed'
    }
  }

  const sessionId = lambdaResult.session_id;
  const fileCount = lambdaResult.file_count || 0;

  // If no files were generated, just return success
  if (fileCount === 0) {
    return {
      success: true,
      data: {
        session_id: sessionId,
        file_count: 0,
        message: 'Claude Code executed successfully but generated no files'
      }
    }
  }

  // Download session files from S3
  let sessionFiles;
  try {
    sessionFiles = await downloadSessionFromS3(sessionId);
  } catch (error) {
    return {
      success: false,
      error: `Failed to download session files: ${error.message}`
    }
  }

  // Create content items for each file
  const createdContent = [];

  for (const file of sessionFiles) {
    // Skip session metadata files
    if (file.path.startsWith('.session/')) {
      continue;
    }

    const contentType = detectContentType(file.path);
    const fileContent = new TextDecoder().decode(file.content);

    const { data: newContent, error: createError } = await supabase
      .from('content')
      .insert({
        type: contentType,
        data: fileContent,
        group_id: group_id,
        user_id: user_id,
        parent_content_id: parent_content_id,
        metadata: {
          filename: file.path,
          claude_session_id: sessionId,
          generated_by_claude_code: true
        }
      })
      .select()
      .single();

    if (createError) {
      console.error(`Failed to create content for file ${file.path}:`, createError);
      continue;
    }

    createdContent.push(newContent);
  }

  return {
    success: true,
    data: {
      session_id: sessionId,
      file_count: createdContent.length,
      files: createdContent.map(c => c.metadata?.filename),
      created_content: createdContent
    }
  }
}

async function handleScreenshotQueue(supabase: any, payload: ScreenshotQueuePayload, authHeader: string): Promise<ContentResponse> {
  const jobs = payload.jobs || []

  if (jobs.length === 0) {
    return {
      success: false,
      error: 'No screenshot jobs provided'
    }
  }

  // Get user from auth header
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) {
    throw new Error('Authentication failed')
  }

  // Queue all screenshot jobs
  const queuePromises = jobs.map(job =>
    enqueueJob(supabase, {
      action: 'screenshot-process',
      payload: {
        contentId: job.contentId,
        url: job.url
      },
      userId: user.id,
      createdAt: new Date().toISOString()
    })
  )

  await Promise.all(queuePromises)

  return {
    success: true,
    queued: true,
    data: {
      message: `${jobs.length} screenshot jobs queued for processing`,
      jobCount: jobs.length
    }
  }
}

async function handleQueueProcess(supabase: any): Promise<ContentResponse> {
  const processedJobs = []
  const maxJobs = 5 // Process up to 5 jobs per invocation

  for (let i = 0; i < maxJobs; i++) {
    // Pop a job from the queue
    const { data: popResult, error: popError } = await supabase
      .schema('pgmq')
      .rpc('pop', { queue_name: 'content' })

    if (popError) {
      console.error('Error popping from queue:', popError)
      break
    }

    if (!popResult || popResult.length === 0) {
      // No more jobs in queue
      break
    }

    const job: ContentQueueJob = popResult[0].message

    try {
      console.log(`Processing queued job: ${job.action}`)

      let result
      switch (job.action) {
        case 'screenshot-process':
          result = await processScreenshotJob(supabase, job.payload as ScreenshotProcessPayload)
          break
        case 'seo-extract':
          result = await processSEOExtractJob(supabase, job.payload as SEOExtractPayload)
          break
        case 'llm-generate':
          result = await processLLMGenerateJob(supabase, job.payload as LLMGeneratePayload)
          break
        default:
          console.error(`Unknown job action: ${job.action}`)
          continue
      }

      processedJobs.push({
        action: job.action,
        result: result.success ? 'completed' : 'failed',
        error: result.error
      })

    } catch (error) {
      console.error(`Error processing job ${job.action}:`, error)
      processedJobs.push({
        action: job.action,
        result: 'failed',
        error: error.message
      })
    }
  }

  return {
    success: true,
    data: {
      processedJobs,
      count: processedJobs.length
    }
  }
}

// Fetch markdown from Cloudflare API using SDK
async function fetchMarkdownFromCloudflare(url: string): Promise<string> {
  try {
    const cloudflareApiKey = Deno.env.get('CLOUDFLARE_API_KEY');
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

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

// Handle markdown extraction
async function handleMarkdownExtract(supabase: any, payload: MarkdownExtractPayload): Promise<ContentResponse> {
  const results = [];

  for (const contentItem of payload.selectedContent) {
    try {
      const result = await processMarkdownForContent(supabase, contentItem);
      results.push(result);
    } catch (error) {
      console.error(`Error processing markdown for content ${contentItem.id}:`, error);
      results.push({
        content_id: contentItem.id,
        success: false,
        error: error.message,
        total_urls_found: 0,
        urls_processed: 0,
        markdown_children: []
      });
    }
  }

  return {
    success: true,
    data: results
  };
}

// Process markdown extraction for a single content item
async function processMarkdownForContent(supabase: any, contentItem: ContentItem) {
  // Extract URLs from content data
  const urls = extractUrls(contentItem.data);

  if (urls.length === 0) {
    return {
      content_id: contentItem.id,
      success: true,
      total_urls_found: 0,
      urls_processed: 0,
      markdown_children: []
    };
  }

  const markdownChildren: ContentItem[] = [];
  let urlsProcessed = 0;
  const errors: string[] = [];

  // Process each URL
  for (const url of urls) {
    try {
      // Fetch markdown from Cloudflare
      const markdown = await fetchMarkdownFromCloudflare(url);

      // Create markdown content as sibling (same parent as original content)
      const { data: markdownContent, error: createError } = await supabase
        .from('content')
        .insert({
          type: 'markdown',
          data: markdown,
          group_id: contentItem.group_id,
          user_id: contentItem.user_id,
          parent_content_id: contentItem.parent_content_id, // Same parent = sibling
          metadata: {
            source_url: url,
            extracted_at: new Date().toISOString(),
            cloudflare_markdown: true,
            source_content_id: contentItem.id
          }
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating markdown content:', createError);
        errors.push(`Error creating markdown content for ${url}: ${createError.message}`);
        continue;
      }

      if (markdownContent) {
        markdownChildren.push(markdownContent as ContentItem);
      }

      urlsProcessed++;

    } catch (error) {
      console.error(`Error processing URL ${url}:`, error);
      errors.push(`Error processing ${url}: ${error.message}`);
    }
  }

  return {
    content_id: contentItem.id,
    success: errors.length === 0,
    total_urls_found: urls.length,
    urls_processed: urlsProcessed,
    markdown_children: markdownChildren,
    errors: errors.length > 0 ? errors : undefined
  };
}

// =============================================================================
// QUEUE OPERATIONS
// =============================================================================

async function enqueueJob(supabase: any, job: ContentQueueJob): Promise<void> {
  const { error } = await supabase
    .schema('pgmq_public')
    .rpc('send', {
      queue_name: 'content',
      message: job
    })

  if (error) {
    throw new Error(`Failed to enqueue job: ${error.message}`)
  }

  console.log(`Enqueued job: ${job.action}`)
}

// =============================================================================
// JOB PROCESSORS
// =============================================================================

async function processScreenshotJob(supabase: any, payload: ScreenshotProcessPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const { contentId, url } = payload

    const cloudflareApiKey = Deno.env.get('CLOUDFLARE_API_KEY');
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    if (!cloudflareApiKey || !accountId) {
      throw new Error('Missing required Cloudflare environment variables');
    }

    const client = new Cloudflare({
      apiToken: cloudflareApiKey,
    });

    // Call Cloudflare Screenshot API using SDK
    const screenshot = await client.browserRendering.screenshot.create({
      account_id: accountId,
      url: url,
      options: {
        full_page: true
      }
    });

    // Convert screenshot to buffer
    const screenshotBuffer = screenshot as ArrayBuffer

    // Upload to Supabase storage
    const fileName = `${contentId}.png`
    const filePath = `public/${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('content')
      .upload(filePath, screenshotBuffer, {
        cacheControl: '3600',
        contentType: 'image/png',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    // Update content with screenshot URL
    const { error: updateError } = await supabase
      .from('content')
      .update({
        metadata: supabase.raw(`metadata || '{"url_preview": "${filePath}"}'::jsonb`)
      })
      .eq('id', contentId)

    if (updateError) {
      console.warn(`Database update failed: ${updateError.message}`)
    }

    console.log(`Screenshot completed for content ${contentId}`)
    return { success: true }

  } catch (error) {
    console.error('Screenshot processing failed:', error)
    return { success: false, error: error.message }
  }
}

async function processSEOExtractJob(supabase: any, payload: SEOExtractPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const results = []

    for (const contentItem of payload.selectedContent) {
      try {
        const result = await processSEOForContent(supabase, contentItem)
        results.push(result)
      } catch (error) {
        console.error(`Error processing SEO for content ${contentItem.id}:`, error)
        results.push({
          content_id: contentItem.id,
          success: false,
          error: error.message,
          total_urls_found: 0,
          urls_processed: 0,
          seo_children: []
        })
      }
    }

    console.log(`SEO extraction completed for ${results.length} content items`)
    return { success: true }

  } catch (error) {
    console.error('SEO extraction job failed:', error)
    return { success: false, error: error.message }
  }
}

async function processLLMGenerateJob(supabase: any, payload: LLMGeneratePayload): Promise<{ success: boolean; error?: string }> {
  try {
    const { system_prompt, selected_content, group_id, parent_content_id } = payload;

    if (!system_prompt || !selected_content || !Array.isArray(selected_content) || selected_content.length === 0) {
      throw new Error('Missing or invalid required fields: system_prompt, selected_content');
    }

    // For queued processing, we need a user_id - get it from the first content item
    const user_id = selected_content[0]?.user_id;
    if (!user_id) {
      throw new Error('Unable to determine user_id from selected content');
    }

    // Format content for LLM context
    const formattedContent = formatContentForContext(selected_content);

    // Call OpenAI API
    const generatedContent = await callOpenAI(system_prompt, formattedContent);

    if (!generatedContent || generatedContent.length === 0) {
      throw new Error('No content was generated by the LLM');
    }

    // Create the prompt content item first
    const { data: promptContent, error: promptError } = await supabase
      .from('content')
      .insert({
        type: 'prompt',
        data: system_prompt,
        group_id: group_id,
        user_id: user_id,
        parent_content_id: parent_content_id,
        metadata: {
          selected_content_ids: selected_content.map(c => c.id),
          generated_count: generatedContent.length,
          created_by_llm: true,
          processed_via_queue: true
        }
      })
      .select()
      .single();

    if (promptError) {
      throw new Error(`Failed to create prompt content: ${promptError.message}`);
    }

    // Create the generated content items as children of the prompt
    const contentToInsert = generatedContent.map(item => ({
      type: item.type,
      data: item.data,
      group_id: group_id,
      user_id: user_id,
      parent_content_id: promptContent.id,
      metadata: {
        generated_by_llm: true,
        prompt_content_id: promptContent.id,
        source_content_ids: selected_content.map(c => c.id),
        processed_via_queue: true
      }
    }));

    const { data: createdContent, error: createError } = await supabase
      .from('content')
      .insert(contentToInsert)
      .select();

    if (createError) {
      // If content creation fails, try to delete the prompt to avoid orphaned prompts
      await supabase.from('content').delete().eq('id', promptContent.id);
      throw new Error(`Failed to create generated content: ${createError.message}`);
    }

    console.log(`LLM generation completed for prompt ${promptContent.id}, created ${createdContent.length} content items`);
    return { success: true };

  } catch (error) {
    console.error('LLM generation job failed:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// YOUTUBE PLAYLIST HANDLERS
// =============================================================================

async function handleYouTubePlaylistExtract(supabase: any, payload: YouTubePlaylistPayload): Promise<ContentResponse> {
  const results = [];

  for (const contentItem of payload.selectedContent) {
    try {
      const result = await processYouTubePlaylistForContent(supabase, contentItem);
      results.push(result);
    } catch (error) {
      console.error(`Error processing YouTube playlist for content ${contentItem.id}:`, error);
      results.push({
        content_id: contentItem.id,
        success: false,
        error: error.message,
        playlists_found: 0,
        videos_created: 0
      });
    }
  }

  return {
    success: true,
    data: results
  };
}

async function processYouTubePlaylistForContent(supabase: any, contentItem: ContentItem) {
  // Extract YouTube playlist URLs from content
  const playlistUrls = extractYouTubePlaylistUrls(contentItem.data);

  if (playlistUrls.length === 0) {
    return {
      content_id: contentItem.id,
      success: true,
      playlists_found: 0,
      videos_created: 0,
      playlist_children: []
    };
  }

  const playlistChildren: ContentItem[] = [];
  let totalVideosCreated = 0;
  const errors: string[] = [];

  for (const playlistUrl of playlistUrls) {
    try {
      // Call Lambda YouTube endpoint
      const lambdaResponse = await fetch('https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/youtube/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: playlistUrl })
      });

      if (!lambdaResponse.ok) {
        throw new Error(`Lambda error: ${lambdaResponse.status}`);
      }

      const lambdaResult = await lambdaResponse.json();

      if (!lambdaResult.success || !lambdaResult.videos) {
        throw new Error('Failed to fetch playlist videos');
      }

      // Create child content items for each video
      // Format: "Video Title\nhttps://youtube.com/watch?v=..."
      const videoContents = lambdaResult.videos.map((video: YouTubeVideo) => ({
        type: 'text',
        data: `${video.title}\n${video.url}`,  // Title + URL formatted together
        group_id: contentItem.group_id,
        user_id: contentItem.user_id,
        parent_content_id: contentItem.id,
        metadata: {
          youtube_video_id: video.id,
          youtube_title: video.title,
          youtube_url: video.url,
          youtube_author: video.author,
          youtube_channel_id: video.channel_id,
          youtube_channel_handle: video.channel_handle,
          youtube_description: video.description,
          youtube_duration: video.duration,
          youtube_views: video.views,
          youtube_publish_date: video.publish_date,
          youtube_thumbnails: video.thumbnails,
          source_playlist_url: playlistUrl,
          extracted_from_playlist: true
        }
      }));

      const { data: createdVideos, error: createError } = await supabase
        .from('content')
        .insert(videoContents)
        .select();

      if (createError) {
        errors.push(`Error creating video content: ${createError.message}`);
        continue;
      }

      playlistChildren.push(...(createdVideos || []));
      totalVideosCreated += createdVideos?.length || 0;

    } catch (error) {
      console.error(`Error processing playlist ${playlistUrl}:`, error);
      errors.push(`Error processing ${playlistUrl}: ${error.message}`);
    }
  }

  return {
    content_id: contentItem.id,
    success: errors.length === 0,
    playlists_found: playlistUrls.length,
    videos_created: totalVideosCreated,
    playlist_children: playlistChildren,
    errors: errors.length > 0 ? errors : undefined
  };
}

// =============================================================================
// TMDB SEARCH HANDLERS
// =============================================================================

async function handleTMDbSearch(supabase: any, payload: TMDbSearchPayload): Promise<ContentResponse> {
  const results = [];

  for (const contentItem of payload.selectedContent) {
    try {
      const result = await processTMDbSearchForContent(
        supabase,
        contentItem,
        payload.searchType || 'multi',
        payload.mode,
        payload.selectedResults
      );
      results.push(result);
    } catch (error) {
      console.error(`Error processing TMDb search for content ${contentItem.id}:`, error);
      results.push({
        content_id: contentItem.id,
        success: false,
        error: error.message,
        queries_found: 0,
        results_created: 0
      });
    }
  }

  return {
    success: true,
    data: results
  };
}

async function processTMDbSearchForContent(
  supabase: any,
  contentItem: ContentItem,
  searchType: 'movie' | 'tv' | 'multi',
  mode: 'search-only' | 'add-selected',
  selectedResults?: number[]
) {
  // Extract search query from content data (use the full text as query)
  const query = contentItem.data.trim();

  if (!query || query.length === 0) {
    return {
      content_id: contentItem.id,
      success: true,
      queries_found: 0,
      results_created: 0,
      tmdb_children: [],
      tmdb_results: []
    };
  }

  const tmdbChildren: ContentItem[] = [];
  const errors: string[] = [];

  try {
    // Get TMDb API key from environment
    const tmdbApiKey = Deno.env.get('TMDB_API_KEY');
    if (!tmdbApiKey) {
      throw new Error('TMDB_API_KEY environment variable not configured');
    }

    // Call TMDb search API
    const endpoint = searchType === 'multi'
      ? `https://api.themoviedb.org/3/search/multi`
      : `https://api.themoviedb.org/3/search/${searchType}`;

    const searchUrl = `${endpoint}?query=${encodeURIComponent(query)}&page=1`;

    const tmdbResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${tmdbApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!tmdbResponse.ok) {
      throw new Error(`TMDb API error: ${tmdbResponse.status}`);
    }

    const searchResults: TMDbSearchResponse = await tmdbResponse.json();

    if (!searchResults.results || searchResults.results.length === 0) {
      return {
        content_id: contentItem.id,
        success: true,
        queries_found: 1,
        results_created: 0,
        tmdb_children: [],
        tmdb_results: [],
        total_results: 0
      };
    }

    // For search-only mode, return results without creating content
    if (mode === 'search-only') {
      const formattedResults = searchResults.results.slice(0, 20).map(result => {
        const isMovie = 'title' in result || result.media_type === 'movie';
        const isTVShow = 'name' in result || result.media_type === 'tv';

        // Skip person results from multi search
        if (!isMovie && !isTVShow) {
          return null;
        }

        let title: string;
        let year: string;
        let overview: string;
        let mediaType: string;

        if (isMovie) {
          const movie = result as TMDbMovie;
          title = movie.title || movie.original_title;
          year = movie.release_date ? new Date(movie.release_date).getFullYear().toString() : '';
          overview = movie.overview || '';
          mediaType = 'movie';
        } else {
          const show = result as TMDbTVShow;
          title = show.name || show.original_name;
          year = show.first_air_date ? new Date(show.first_air_date).getFullYear().toString() : '';
          overview = show.overview || '';
          mediaType = 'tv';
        }

        const posterUrl = result.poster_path
          ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
          : null;

        const backdropUrl = result.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}`
          : null;

        return {
          tmdb_id: result.id,
          media_type: mediaType,
          title,
          year,
          overview,
          poster_url: posterUrl,
          backdrop_url: backdropUrl,
          vote_average: result.vote_average,
          vote_count: result.vote_count,
          popularity: result.popularity
        };
      }).filter(Boolean);

      return {
        content_id: contentItem.id,
        success: true,
        queries_found: 1,
        results_created: 0,
        tmdb_children: [],
        tmdb_results: formattedResults,
        total_results: searchResults.total_results
      };
    }

    // For add-selected mode, filter results by selectedResults IDs
    const resultsToCreate = searchResults.results.filter(result =>
      selectedResults && selectedResults.includes(result.id)
    );

    for (const result of resultsToCreate) {
      try {
        const isMovie = 'title' in result || result.media_type === 'movie';
        const isTVShow = 'name' in result || result.media_type === 'tv';

        // Skip person results from multi search
        if (!isMovie && !isTVShow) {
          continue;
        }

        let title: string;
        let year: string;
        let overview: string;
        let mediaType: string;

        if (isMovie) {
          const movie = result as TMDbMovie;
          title = movie.title || movie.original_title;
          year = movie.release_date ? new Date(movie.release_date).getFullYear().toString() : '';
          overview = movie.overview || '';
          mediaType = 'movie';
        } else {
          const show = result as TMDbTVShow;
          title = show.name || show.original_name;
          year = show.first_air_date ? new Date(show.first_air_date).getFullYear().toString() : '';
          overview = show.overview || '';
          mediaType = 'tv';
        }

        // Format data: "Title (Year)\nOverview"
        const displayText = year
          ? `${title} (${year})\n${overview}`
          : `${title}\n${overview}`;

        // Construct poster URL if available
        const posterUrl = result.poster_path
          ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
          : null;

        const backdropUrl = result.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}`
          : null;

        // Create content item
        const { data: newContent, error: createError } = await supabase
          .from('content')
          .insert({
            type: 'text',
            data: displayText,
            group_id: contentItem.group_id,
            user_id: contentItem.user_id,
            parent_content_id: contentItem.id,
            metadata: {
              tmdb_id: result.id,
              tmdb_media_type: mediaType,
              tmdb_title: title,
              tmdb_overview: overview,
              tmdb_poster_path: result.poster_path,
              tmdb_poster_url: posterUrl,
              tmdb_backdrop_path: result.backdrop_path,
              tmdb_backdrop_url: backdropUrl,
              tmdb_vote_average: result.vote_average,
              tmdb_vote_count: result.vote_count,
              tmdb_popularity: result.popularity,
              tmdb_genre_ids: result.genre_ids,
              tmdb_original_language: result.original_language,
              tmdb_release_date: isMovie ? (result as TMDbMovie).release_date : (result as TMDbTVShow).first_air_date,
              source_query: query,
              extracted_from_tmdb_search: true
            }
          })
          .select()
          .single();

        if (createError) {
          console.error(`Error creating TMDb content for ${title}:`, createError);
          errors.push(`Error creating content for ${title}: ${createError.message}`);
          continue;
        }

        if (newContent) {
          tmdbChildren.push(newContent as ContentItem);
        }

      } catch (error) {
        console.error(`Error processing TMDb result:`, error);
        errors.push(`Error processing result: ${error.message}`);
      }
    }

  } catch (error) {
    console.error(`Error searching TMDb for query "${query}":`, error);
    errors.push(`Error searching TMDb: ${error.message}`);
  }

  return {
    content_id: contentItem.id,
    success: errors.length === 0,
    queries_found: 1,
    results_created: tmdbChildren.length,
    tmdb_children: tmdbChildren,
    errors: errors.length > 0 ? errors : undefined
  };
}