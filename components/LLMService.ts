import { supabase } from './SupabaseClient';
import { Content } from './ContentRepository';

export interface LLMRequest {
  system_prompt: string;
  selected_content: Content[];
  group_id: string;
  parent_content_id?: string | null;
}

export interface GeneratedContent {
  type: string;
  data: string;
}

export interface LLMResponse {
  success: boolean;
  generated_content?: GeneratedContent[];
  prompt_content_id?: string;
  error?: string;
}

export class LLMService {

  static async generateContent(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Validate input
      if (!request.system_prompt?.trim()) {
        throw new Error('System prompt is required');
      }

      if (!request.selected_content || request.selected_content.length === 0) {
        throw new Error('At least one content item must be selected');
      }

      if (!request.group_id) {
        throw new Error('Group ID is required');
      }

      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('llm-generate', {
        body: {
          system_prompt: request.system_prompt,
          selected_content: request.selected_content,
          group_id: request.group_id,
          parent_content_id: request.parent_content_id
        }
      });

      if (error) {
        console.error('Edge Function error:', error);
        throw new Error(`LLM service error: ${error.message || 'Unknown error'}`);
      }

      if (!data) {
        throw new Error('No response from LLM service');
      }

      const response = data as LLMResponse;

      if (!response.success) {
        throw new Error(response.error || 'LLM generation failed');
      }

      return response;

    } catch (error) {
      console.error('LLM Service error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  static async testConnection(): Promise<boolean> {
    try {
      // Simple test to verify the Edge Function is accessible
      const { error } = await supabase.functions.invoke('llm-generate', {
        body: {
          system_prompt: 'test',
          selected_content: [],
          group_id: 'test'
        }
      });

      // We expect this to fail with validation error, but if function is accessible
      // the error should be about missing content, not about function not found
      return error?.message?.includes('selected_content') ||
             error?.message?.includes('authorization') ||
             error?.message?.includes('Missing or invalid');
    } catch (error) {
      console.error('LLM Service connection test failed:', error);
      return false;
    }
  }

  static formatPromptPreview(prompt: string, maxLength: number = 100): string {
    if (prompt.length <= maxLength) {
      return prompt;
    }
    return prompt.substring(0, maxLength) + '...';
  }

  static formatSelectedContentSummary(content: Content[]): string {
    const typeGroups: Record<string, number> = {};

    content.forEach(item => {
      typeGroups[item.type] = (typeGroups[item.type] || 0) + 1;
    });

    const typeSummaries = Object.entries(typeGroups).map(([type, count]) => {
      const plural = count > 1 ? 's' : '';
      return `${count} ${type}${plural}`;
    });

    return typeSummaries.join(', ');
  }

  static validatePrompt(prompt: string): { isValid: boolean; error?: string } {
    if (!prompt || !prompt.trim()) {
      return { isValid: false, error: 'Prompt cannot be empty' };
    }

    if (prompt.trim().length < 3) {
      return { isValid: false, error: 'Prompt must be at least 3 characters long' };
    }

    if (prompt.length > 4000) {
      return { isValid: false, error: 'Prompt must be less than 4000 characters' };
    }

    return { isValid: true };
  }
}

export default LLMService;