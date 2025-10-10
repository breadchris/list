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
import { processTMDbSearchForContent } from './tmdb-client.js';

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
