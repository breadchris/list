import type { OpenAIMessage, GeneratedContent, ContentItem } from './types.js';

// OpenAI tool definitions for LLM generation
export const tools = [
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
export function formatContentForContext(selectedContent: ContentItem[]): string {
  return selectedContent.map((item, index) => {
    const metadata = item.metadata ? `\nMetadata: ${JSON.stringify(item.metadata, null, 2)}` : '';
    return `Content Item ${index + 1}:
Type: ${item.type}
Data: ${item.data}${metadata}
Created: ${item.created_at}`;
  }).join('\n\n---\n\n');
}

// Call OpenAI API with tool calling
export async function callOpenAI(systemPrompt: string, userContent: string): Promise<GeneratedContent[]> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
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

  let result: any = await response.json();

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

// Call OpenAI Chat Completion (for chat messages)
export async function callOpenAIChat(messages: OpenAIMessage[], stream?: boolean): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: stream || false
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
  }

  const result: any = await response.json();
  const assistantMessage = result.choices[0]?.message?.content;

  if (!assistantMessage) {
    throw new Error('No response from OpenAI');
  }

  return assistantMessage;
}

// Call OpenAI Chat Completion with streaming support
export async function* callOpenAIChatStream(messages: OpenAIMessage[]): AsyncGenerator<string, void, unknown> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: true
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
  }

  if (!response.body) {
    throw new Error('No response body available for streaming');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith(':')) {
          continue;
        }

        // Parse SSE data
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6);

          // Check for stream end
          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;

            if (content) {
              yield content;
            }
          } catch (error) {
            console.error('Error parsing SSE data:', error, 'Data:', data);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
