import { supabase } from './SupabaseClient';
import { Content } from './ContentRepository';
import { LambdaClient } from './LambdaClient';

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

  static async generateContent(request: LLMRequest, useQueue: boolean = false): Promise<LLMResponse & { queued?: boolean }> {
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

      // Call Lambda content endpoint
      const response = await LambdaClient.invoke({
        action: 'llm-generate',
        payload: {
          system_prompt: request.system_prompt,
          selected_content: request.selected_content,
          group_id: request.group_id,
          parent_content_id: request.parent_content_id
        }
      });

      if (!response.success) {
        throw new Error(response.error || 'LLM generation failed');
      }

      // For immediate processing, extract the actual response data
      const responseData = response.data;
      return {
        success: true,
        generated_content: responseData.generated_content,
        prompt_content_id: responseData.prompt_content_id
      };

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
      // Simple test to verify the Lambda endpoint is accessible
      return await LambdaClient.testConnection();
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