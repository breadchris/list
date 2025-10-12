import { supabase } from './SupabaseClient';
import { Content } from './ContentRepository';
import { LambdaClient } from './LambdaClient';

export interface MarkdownRequest {
  selected_content: Content[];
}

export interface MarkdownChild {
  id: string;
  type: string;
  data: string;
  metadata: any;
  created_at: string;
}

export interface MarkdownResult {
  content_id: string;
  success: boolean;
  total_urls_found: number;
  urls_processed: number;
  markdown_children: MarkdownChild[];
  errors?: string[];
}

export interface MarkdownResponse {
  success: boolean;
  data?: MarkdownResult[];
  error?: string;
}

export class MarkdownService {

  static async extractMarkdown(content: Content[]): Promise<MarkdownResponse> {
    try {
      // Validate input
      if (!content || content.length === 0) {
        throw new Error('At least one content item must be selected');
      }

      // Call Lambda content endpoint
      const response = await LambdaClient.invoke({
        action: 'markdown-extract',
        payload: {
          selectedContent: content
        }
      });

      if (!response.success) {
        throw new Error(response.error || 'Markdown extraction failed');
      }

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      console.error('Markdown Service error:', error);

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
      console.error('Markdown Service connection test failed:', error);
      return false;
    }
  }

  static formatUrlCount(urls: number): string {
    return urls === 1 ? '1 URL' : `${urls} URLs`;
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
}

export default MarkdownService;
