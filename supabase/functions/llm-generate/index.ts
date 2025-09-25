import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

interface LLMRequest {
  system_prompt: string;
  selected_content: ContentItem[];
  group_id: string;
  parent_content_id?: string | null;
}

interface GeneratedContent {
  type: string;
  data: string;
}

interface LLMResponse {
  success: boolean;
  generated_content?: GeneratedContent[];
  prompt_content_id?: string;
  error?: string;
}

// OpenAI types and tool definitions
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

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control',
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
      return new Response(JSON.stringify({
        success: false,
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Get request body
    const requestData: LLMRequest = await req.json();
    const { system_prompt, selected_content, group_id, parent_content_id } = requestData;

    if (!system_prompt || !selected_content || !Array.isArray(selected_content) || selected_content.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing or invalid required fields: system_prompt, selected_content'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Get auth token from request headers
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing authorization header'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
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

    // Get user from auth token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or expired authorization token'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Format content for LLM context
    const formattedContent = formatContentForContext(selected_content);

    // Call OpenAI API
    const generatedContent = await callOpenAI(system_prompt, formattedContent);

    if (!generatedContent || generatedContent.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No content was generated by the LLM'
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Create the prompt content item first
    const { data: promptContent, error: promptError } = await supabase
      .from('content')
      .insert({
        type: 'prompt',
        data: system_prompt,
        group_id: group_id,
        user_id: user.id,
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
      user_id: user.id,
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

    const response: LLMResponse = {
      success: true,
      generated_content: generatedContent,
      prompt_content_id: promptContent.id
    };

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('LLM Generation error:', error);

    const response: LLMResponse = {
      success: false,
      error: error.message || 'Internal server error'
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});