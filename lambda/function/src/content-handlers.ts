import type {
  ContentResponse,
  SEOExtractPayload,
  LLMGeneratePayload,
  ChatMessagePayload,
  MarkdownExtractPayload,
  YouTubePlaylistPayload,
  YouTubeSubtitlePayload,
  YouTubeSubtitleResult,
  TMDbSearchPayload,
  LibgenSearchPayload,
  ScreenshotQueuePayload,
  TSXTranspilePayload,
  TSXTranspileResponse,
  TranscribeAudioPayload,
  TranscribeAudioResult,
  ContentItem,
  OpenAIMessage
} from './types.js';
import { extractUrls, extractYouTubePlaylistUrls, fetchSEOMetadata } from './utils.js';
import { callOpenAI, callOpenAIChat, formatContentForContext } from './openai-client.js';
import { fetchMarkdownFromCloudflare, generateScreenshot } from './cloudflare-client.js';
import { processTMDbSearchForContent } from './tmdb-client.js';
import { searchLibgen, type BookInfo } from './libgen-client.js';
import { createClient } from '@deepgram/sdk';
import { executeGo } from './go-executor.js';
import type { SubtitleRequest } from './go-client.js';
import { isSubtitleResponse } from './go-client.js';
import { executeYouTubeTranscript } from './python-client.js';

// =============================================================================
// SEO EXTRACTION
// =============================================================================

export async function handleSEOExtract(supabase: any, payload: SEOExtractPayload): Promise<ContentResponse> {
  const results = [];

  for (const contentItem of payload.selectedContent) {
    try {
      const result = await processSEOForContent(supabase, contentItem);
      results.push(result);
    } catch (error: any) {
      console.error(`Error processing SEO for content ${contentItem.id}:`, error);
      results.push({
        content_id: contentItem.id,
        success: false,
        error: error.message,
        total_urls_found: 0,
        urls_processed: 0,
        seo_children: []
      });
    }
  }

  return {
    success: true,
    data: results
  };
}

export async function processSEOForContent(supabase: any, contentItem: ContentItem) {
  // Extract URLs from content data
  const urls = extractUrls(contentItem.data);

  if (urls.length === 0) {
    return {
      content_id: contentItem.id,
      success: true,
      total_urls_found: 0,
      urls_processed: 0,
      seo_children: []
    };
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
        errors.push(`Error checking existing SEO for ${url}: ${seoError.message}`);
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
        errors.push(`Error creating SEO content for ${url}: ${upsertError.message}`);
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

    } catch (error: any) {
      console.error(`Error processing URL ${url}:`, error);
      errors.push(`Error processing ${url}: ${error.message}`);
    }
  }

  return {
    content_id: contentItem.id,
    success: errors.length === 0,
    total_urls_found: urls.length,
    urls_processed: urlsProcessed,
    seo_children: seoChildren,
    errors: errors.length > 0 ? errors : undefined
  };
}

// =============================================================================
// LLM GENERATION
// =============================================================================

export async function handleLLMGenerate(supabase: any, payload: LLMGeneratePayload): Promise<ContentResponse> {
  const { system_prompt, selected_content, group_id, parent_content_id } = payload;

  if (!system_prompt || !selected_content || !Array.isArray(selected_content) || selected_content.length === 0) {
    return {
      success: false,
      error: 'Missing or invalid required fields: system_prompt, selected_content'
    };
  }

  const user_id = selected_content[0]?.user_id;
  if (!user_id) {
    return {
      success: false,
      error: 'Unable to determine user_id from selected content'
    };
  }

  // Format content for LLM context
  const formattedContent = formatContentForContext(selected_content);

  // Call OpenAI API
  const generatedContent = await callOpenAI(system_prompt, formattedContent);

  if (!generatedContent || generatedContent.length === 0) {
    return {
      success: false,
      error: 'No content was generated by the LLM'
    };
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
        selected_content_ids: selected_content.map((c: ContentItem) => c.id),
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
      source_content_ids: selected_content.map((c: ContentItem) => c.id)
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
  };
}

// =============================================================================
// CHAT
// =============================================================================

export async function handleChatMessage(supabase: any, payload: ChatMessagePayload): Promise<ContentResponse> {
  const { chat_content_id, message, group_id } = payload;

  // Validate payload
  if (!chat_content_id || !message || !group_id) {
    return {
      success: false,
      error: 'Missing required fields: chat_content_id, message, group_id'
    };
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
    };
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
    };
  }

  // 3. Build OpenAI messages array from conversation history
  const openAIMessages: OpenAIMessage[] = (conversationHistory || []).map((msg: any) => ({
    role: msg.metadata?.role === 'assistant' ? 'assistant' : 'user',
    content: msg.data
  }));

  // Add current message
  openAIMessages.push({
    role: 'user',
    content: message
  });

  // 4. Create empty assistant message immediately
  const { data: assistantContent, error: assistantError } = await supabase
    .from('content')
    .insert({
      type: 'text',
      data: '', // Start with empty message
      group_id: group_id,
      user_id: user_id,
      parent_content_id: chat_content_id,
      metadata: {
        role: 'assistant',
        model: 'gpt-4',
        created_by_chat: true,
        streaming: true
      }
    })
    .select()
    .single();

  if (assistantError) {
    return {
      success: false,
      error: `Failed to create assistant message: ${assistantError.message}`
    };
  }

  // 5. Stream OpenAI response and update content in real-time
  try {
    let fullMessage = '';

    // Import the streaming function
    const { callOpenAIChatStream } = await import('./openai-client.js');

    for await (const chunk of callOpenAIChatStream(openAIMessages)) {
      fullMessage += chunk;

      // Update the assistant message content with accumulated text
      const { error: updateError } = await supabase
        .from('content')
        .update({
          data: fullMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', assistantContent.id);

      if (updateError) {
        console.error('Error updating message during stream:', updateError);
      }
    }

    // Mark streaming as complete
    await supabase
      .from('content')
      .update({
        metadata: {
          role: 'assistant',
          model: 'gpt-4',
          created_by_chat: true,
          streaming: false
        }
      })
      .eq('id', assistantContent.id);

    return {
      success: true,
      data: {
        assistant_message: fullMessage,
        assistant_content_id: assistantContent.id
      }
    };
  } catch (error: any) {
    // If streaming fails, update the message with error
    await supabase
      .from('content')
      .update({
        data: `Error generating response: ${error.message}`,
        metadata: {
          role: 'assistant',
          model: 'gpt-4',
          created_by_chat: true,
          streaming: false,
          error: true
        }
      })
      .eq('id', assistantContent.id);

    return {
      success: false,
      error: `Streaming failed: ${error.message}`
    };
  }
}

// =============================================================================
// MARKDOWN EXTRACTION
// =============================================================================

export async function handleMarkdownExtract(supabase: any, payload: MarkdownExtractPayload): Promise<ContentResponse> {
  const results = [];

  for (const contentItem of payload.selectedContent) {
    try {
      const result = await processMarkdownForContent(supabase, contentItem);
      results.push(result);
    } catch (error: any) {
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

export async function processMarkdownForContent(supabase: any, contentItem: ContentItem) {
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

      // Create markdown content as child of the requesting content
      const { data: markdownContent, error: createError } = await supabase
        .from('content')
        .insert({
          type: 'markdown',
          data: markdown,
          group_id: contentItem.group_id,
          user_id: contentItem.user_id,
          parent_content_id: contentItem.id, // Child of the content that requested markdown
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

    } catch (error: any) {
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
// YOUTUBE PLAYLIST
// =============================================================================

export async function handleYouTubePlaylistExtract(supabase: any, payload: YouTubePlaylistPayload): Promise<ContentResponse> {
  const results = [];

  for (const contentItem of payload.selectedContent) {
    try {
      const result = await processYouTubePlaylistForContent(supabase, contentItem);
      results.push(result);
    } catch (error: any) {
      console.error(`Error processing YouTube playlist for content ${contentItem.id}:`, error);
      results.push({
        content_id: contentItem.id,
        success: false,
        error: error.message,
        playlist_urls_found: 0,
        videos_created: 0
      });
    }
  }

  return {
    success: true,
    data: results
  };
}

export async function processYouTubePlaylistForContent(supabase: any, contentItem: ContentItem) {
  // Extract YouTube playlist URLs from content data
  const playlistUrls = extractYouTubePlaylistUrls(contentItem.data);

  if (playlistUrls.length === 0) {
    return {
      content_id: contentItem.id,
      success: true,
      playlist_urls_found: 0,
      videos_created: 0,
      playlist_children: []
    };
  }

  const playlistChildren: ContentItem[] = [];
  const errors: string[] = [];

  // Process each playlist URL
  for (const playlistUrl of playlistUrls) {
    try {
      // Call Lambda to fetch playlist videos
      const lambdaEndpoint = process.env.LAMBDA_ENDPOINT || 'https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com';
      const response = await fetch(`${lambdaEndpoint}/youtube/playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: playlistUrl })
      });

      if (!response.ok) {
        throw new Error(`Lambda API error: ${response.status}`);
      }

      const data = await response.json() as { videos: any[] };
      const { videos } = data;

      // Create content items for each video
      for (const video of videos) {
        const videoData = `${video.title}\n${video.url}`;
        const { data: videoContent, error: createError } = await supabase
          .from('content')
          .insert({
            type: 'text',
            data: videoData,
            group_id: contentItem.group_id,
            user_id: contentItem.user_id,
            parent_content_id: contentItem.id,
            metadata: {
              youtube_video_id: video.id,
              youtube_title: video.title,
              youtube_url: video.url,
              youtube_thumbnail: video.thumbnail,
              playlist_url: playlistUrl,
              extracted_from_playlist: true
            }
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating video content:', createError);
          errors.push(`Error creating video content: ${createError.message}`);
          continue;
        }

        if (videoContent) {
          playlistChildren.push(videoContent as ContentItem);
        }
      }

    } catch (error: any) {
      console.error(`Error processing playlist ${playlistUrl}:`, error);
      errors.push(`Error processing playlist: ${error.message}`);
    }
  }

  return {
    content_id: contentItem.id,
    success: errors.length === 0,
    playlist_urls_found: playlistUrls.length,
    videos_created: playlistChildren.length,
    playlist_children: playlistChildren,
    errors: errors.length > 0 ? errors : undefined
  };
}

// =============================================================================
// TMDB SEARCH
// =============================================================================

export async function handleTMDbSearch(supabase: any, payload: TMDbSearchPayload): Promise<ContentResponse> {
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
    } catch (error: any) {
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

// =============================================================================
// LIBGEN BOOK SEARCH
// =============================================================================

export async function handleLibgenSearch(supabase: any, payload: LibgenSearchPayload): Promise<ContentResponse> {
  const results = [];
  const autoCreate = payload.autoCreate !== false; // Default to true for backward compatibility

  for (const contentItem of payload.selectedContent) {
    try {
      const result = await processLibgenSearchForContent(
        supabase,
        contentItem,
        payload.searchType || 'default',
        payload.topics || ['libgen'],
        payload.filters,
        payload.maxResults || 10,
        autoCreate
      );
      results.push(result);
    } catch (error: any) {
      console.error(`Error processing Libgen search for content ${contentItem.id}:`, error);
      results.push({
        content_id: contentItem.id,
        success: false,
        error: error.message,
        books_found: 0,
        books_created: 0
      });
    }
  }

  return {
    success: true,
    data: results
  };
}

async function processLibgenSearchForContent(
  supabase: any,
  contentItem: ContentItem,
  searchType: 'default' | 'title' | 'author',
  topics: string[],
  filters?: Record<string, string>,
  maxResults: number = 10,
  autoCreate: boolean = true
) {
  // Use content data as search query
  const query = contentItem.data.trim();

  if (!query) {
    return {
      content_id: contentItem.id,
      success: true,
      books_found: 0,
      books_created: 0,
      book_children: []
    };
  }

  // Search Libgen
  const books = await searchLibgen({
    query,
    search_type: searchType,
    topics,
    filters
  });

  const bookChildren: any[] = [];
  let booksCreated = 0;

  // Limit results only when auto-creating (to avoid creating too many items)
  // When not auto-creating, return all results for user selection
  const limitedBooks = autoCreate ? books.slice(0, maxResults) : books;

  // Create child content items for each book (or just format metadata if autoCreate is false)
  for (const book of limitedBooks) {
    try {
      // Format book data
      const bookData = formatBookData(book);
      const bookMetadata = {
        libgen: {
          id: book.id,
          md5: book.md5,
          publisher: book.publisher,
          year: book.year,
          language: book.language,
          pages: book.pages,
          size: book.size,
          extension: book.extension,
          mirrors: book.mirrors,
          search_query: query,
          search_type: searchType
        }
      };

      if (autoCreate) {
        // Insert book as child content
        const { data: bookContent, error: insertError } = await supabase
          .from('content')
          .insert({
            type: 'text',
            data: bookData,
            metadata: bookMetadata,
            group_id: contentItem.group_id,
            user_id: contentItem.user_id,
            parent_content_id: contentItem.id
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error inserting book content:', insertError);
          continue;
        }

        bookChildren.push(bookContent);
        booksCreated++;
      } else {
        // Just return book metadata without creating Content (for user selection in modal)
        // Create a mock Content object with a temporary ID
        const mockContent = {
          id: `temp-${book.md5 || book.id}`, // Temporary ID for frontend use
          type: 'text',
          data: bookData,
          metadata: bookMetadata,
          group_id: contentItem.group_id,
          user_id: contentItem.user_id,
          parent_content_id: contentItem.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          search_vector: null,
          path: null,
          child_count: 0,
          tags: []
        };
        bookChildren.push(mockContent);
      }
    } catch (error: any) {
      console.error(`Error processing book ${book.title}:`, error);
    }
  }

  return {
    content_id: contentItem.id,
    success: true,
    books_found: books.length,
    books_created: booksCreated,
    book_children: bookChildren
  };
}

function formatBookData(book: BookInfo): string {
  const parts = [];

  if (book.title) {
    parts.push(`📚 ${book.title}`);
  }

  if (book.author) {
    parts.push(`👤 ${book.author}`);
  }

  const details = [];
  if (book.year) details.push(book.year);
  if (book.publisher) details.push(book.publisher);
  if (book.language) details.push(book.language);
  if (book.pages) details.push(`${book.pages} pages`);
  if (book.size) details.push(book.size);
  if (book.extension) details.push(book.extension.toUpperCase());

  if (details.length > 0) {
    parts.push(details.join(' • '));
  }

  return parts.join('\n');
}

// =============================================================================
// SCREENSHOT GENERATION
// =============================================================================

export async function handleScreenshotQueue(supabase: any, payload: ScreenshotQueuePayload): Promise<ContentResponse> {
  const results = [];

  for (const job of payload.jobs) {
    try {
      const result = await processScreenshotForContent(supabase, job.contentId, job.url);
      results.push(result);
    } catch (error: any) {
      console.error(`Error processing screenshot for content ${job.contentId}:`, error);
      results.push({
        content_id: job.contentId,
        url: job.url,
        success: false,
        error: error.message
      });
    }
  }

  return {
    success: true,
    data: results
  };
}

async function processScreenshotForContent(supabase: any, contentId: string, url: string) {
  try {
    console.log(`Generating screenshot for content ${contentId} with URL: ${url}`);

    // Generate screenshot using Cloudflare Browser Rendering
    const screenshotBuffer = await generateScreenshot(url);

    // Convert ArrayBuffer to Buffer (Node.js)
    const buffer = Buffer.from(screenshotBuffer);

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `screenshots/${contentId}-${timestamp}.png`;

    console.log(`Uploading screenshot to storage: ${filename}`);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('content')
      .upload(filename, buffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload screenshot: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase
      .storage
      .from('content')
      .getPublicUrl(filename);

    const publicUrl = publicUrlData.publicUrl;

    console.log(`Screenshot uploaded successfully: ${publicUrl}`);

    // Update content metadata with url_preview
    const { data: content, error: fetchError } = await supabase
      .from('content')
      .select('metadata')
      .eq('id', contentId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch content metadata: ${fetchError.message}`);
    }

    // Update metadata with url_preview
    const updatedMetadata = {
      ...content.metadata,
      url_preview: publicUrl
    };

    const { error: updateError } = await supabase
      .from('content')
      .update({ metadata: updatedMetadata })
      .eq('id', contentId);

    if (updateError) {
      throw new Error(`Failed to update metadata: ${updateError.message}`);
    }

    console.log(`Updated content ${contentId} with url_preview: ${publicUrl}`);

    return {
      content_id: contentId,
      url: url,
      success: true,
      screenshot_url: publicUrl
    };

  } catch (error: any) {
    console.error(`Error processing screenshot for ${url}:`, error);
    throw error;
  }
}

// =============================================================================
// TSX TRANSPILATION
// =============================================================================

import { transpileTSX, validateTSXSource } from './tsx-transpiler.js';

/**
 * Handle TSX transpilation
 * Transpiles TSX source code to JavaScript ES module
 */
export async function handleTSXTranspile(supabase: any, payload: TSXTranspilePayload): Promise<TSXTranspileResponse> {
  try {
    // Validate input
    if (!payload.tsx_code) {
      return {
        success: false,
        error: 'tsx_code is required'
      };
    }

    // Validate source code
    const validation = validateTSXSource(payload.tsx_code);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    const filename = payload.filename || 'component.tsx';

    console.log(`Transpiling TSX: ${filename} (${payload.tsx_code.length} bytes)`);

    // Transpile using esbuild
    const result = await transpileTSX(payload.tsx_code, filename);

    if (!result.success) {
      console.error(`TSX transpilation failed for ${filename}:`, result.error);
      return {
        success: false,
        error: result.error,
        errors: result.errors,
        warnings: result.warnings
      };
    }

    console.log(`TSX transpilation completed for ${filename} (${result.compiledJS?.length || 0} bytes)`);

    return {
      success: true,
      compiled_js: result.compiledJS,
      warnings: result.warnings
    };

  } catch (error: any) {
    console.error('TSX transpilation handler error:', error);
    return {
      success: false,
      error: error.message || 'Unknown transpilation error'
    };
  }
}

// =============================================================================
// AUDIO TRANSCRIPTION
// =============================================================================

/**
 * Handle audio transcription using Deepgram API
 * Creates a child content item with type='transcript' containing the Deepgram response
 */
export async function handleTranscribeAudio(supabase: any, payload: TranscribeAudioPayload): Promise<ContentResponse> {
  const results: TranscribeAudioResult[] = [];

  for (const contentItem of payload.selectedContent) {
    try {
      const result = await processTranscribeAudioForContent(supabase, contentItem);
      results.push(result);

      // Call progress callback if provided
      if (payload.onProgress) {
        payload.onProgress(result);
      }
    } catch (error: any) {
      console.error(`Error transcribing audio for content ${contentItem.id}:`, error);
      results.push({
        content_id: contentItem.id,
        success: false,
        error: error.message
      });
    }
  }

  return {
    success: true,
    data: results
  };
}

async function processTranscribeAudioForContent(supabase: any, contentItem: ContentItem): Promise<TranscribeAudioResult> {
  // Validate content type
  if (contentItem.type !== 'audio') {
    throw new Error('Content item must be of type "audio"');
  }

  // Extract audio URL from metadata
  const audioUrl = contentItem.metadata?.audio_url;
  if (!audioUrl) {
    throw new Error('No audio_url found in content metadata');
  }

  console.log(`Transcribing audio for content ${contentItem.id}: ${audioUrl}`);

  // Get Deepgram API key from environment
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramApiKey) {
    throw new Error('DEEPGRAM_API_KEY environment variable not set');
  }

  // Initialize Deepgram client
  const deepgram = createClient(deepgramApiKey);

  // Transcribe audio using Deepgram
  const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
    {
      url: audioUrl
    },
    {
      model: 'nova-2',
      smart_format: true,
      punctuate: true,
      paragraphs: true,
      utterances: true,
      diarize: true
    }
  );

  if (error) {
    throw new Error(`Deepgram API error: ${error.message}`);
  }

  console.log(`Transcription completed for content ${contentItem.id}`);

  // Create transcript content as child
  const { data: transcriptContent, error: insertError } = await supabase
    .from('content')
    .insert({
      type: 'transcript',
      data: result.results.channels[0]?.alternatives[0]?.transcript || '',
      metadata: {
        deepgram_response: result,
        source_audio_url: audioUrl,
        source_content_id: contentItem.id,
        transcribed_at: new Date().toISOString()
      },
      group_id: contentItem.group_id,
      user_id: contentItem.user_id,
      parent_content_id: contentItem.id
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to create transcript content: ${insertError.message}`);
  }

  console.log(`Created transcript content ${transcriptContent.id} for audio ${contentItem.id}`);

  return {
    content_id: contentItem.id,
    success: true,
    transcript_content_id: transcriptContent.id
  };
}

// =============================================================================
// YOUTUBE SUBTITLE EXTRACTION
// =============================================================================

/**
 * Extract YouTube subtitles/captions for selected content items
 * Creates child content items with type='transcript' for each subtitle track
 */
export async function handleYouTubeSubtitleExtract(supabase: any, payload: YouTubeSubtitlePayload): Promise<ContentResponse> {
  const results: YouTubeSubtitleResult[] = [];

  for (const contentItem of payload.selectedContent) {
    try {
      const result = await processYouTubeSubtitlesForContent(supabase, contentItem);
      results.push(result);
    } catch (error: any) {
      console.error(`Error extracting subtitles for content ${contentItem.id}:`, error);
      results.push({
        content_id: contentItem.id,
        success: false,
        error: error.message
      });
    }
  }

  return {
    success: true,
    data: results
  };
}

async function processYouTubeSubtitlesForContent(supabase: any, contentItem: ContentItem): Promise<YouTubeSubtitleResult> {
  // Extract YouTube video ID from content
  let videoId: string | null = null;

  // First check metadata (from playlist extraction)
  if (contentItem.metadata?.youtube_video_id) {
    videoId = contentItem.metadata.youtube_video_id;
  } else {
    // Extract from content data (URL)
    videoId = extractYouTubeVideoId(contentItem.data);
  }

  if (!videoId) {
    throw new Error('No YouTube video ID found in content');
  }

  console.log(`Extracting transcript for video ID: ${videoId} using yt-dlp`);

  // Build full YouTube URL
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Call Python script to extract transcript using yt-dlp
  const transcriptData = await executeYouTubeTranscript(videoUrl);

  console.log(`Successfully extracted transcript for "${transcriptData.title}" (${transcriptData.channel})`);
  console.log(`Transcript has ${transcriptData.transcript.length} segments`);

  // Convert transcript segments to full text
  const transcriptText = transcriptData.transcript
    .map(segment => segment.text)
    .join(' ');

  // Create transcript content as child
  const { data: transcriptContent, error: insertError } = await supabase
    .from('content')
    .insert({
      type: 'transcript',
      data: transcriptText,
      metadata: {
        youtube_video_id: videoId,
        video_title: transcriptData.title,
        channel: transcriptData.channel,
        source_content_id: contentItem.id,
        subtitle_extracted_at: new Date().toISOString(),
        // Store word-level timing data for future features (video player sync, etc.)
        segments: transcriptData.transcript,
        segment_count: transcriptData.transcript.length
      },
      group_id: contentItem.group_id,
      user_id: contentItem.user_id,
      parent_content_id: contentItem.id
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to create transcript content: ${insertError.message}`);
  }

  if (!transcriptContent) {
    throw new Error('No transcript content returned from insert');
  }

  console.log(`Created transcript content ${transcriptContent.id} for video "${transcriptData.title}"`);

  return {
    content_id: contentItem.id,
    success: true,
    video_id: videoId,
    tracks_found: 1,
    transcript_content_ids: [transcriptContent.id]
  };
}

/**
 * Extract YouTube video ID from various URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/embed/VIDEO_ID
 */
function extractYouTubeVideoId(text: string): string | null {
  const patterns = [
    // Standard watch URLs: youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    // Short URLs: youtu.be/VIDEO_ID
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Embed URLs: youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
