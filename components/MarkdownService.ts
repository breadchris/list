import { supabase } from './SupabaseClient';
import { Content } from './ContentRepository';

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

      // Call the consolidated content function
      const { data, error } = await supabase.functions.invoke('content', {
        body: {
          action: 'markdown-extract',
          payload: {
            selectedContent: content
          }
        }
      });

      if (error) {
        console.error('Edge Function error:', error);
        throw new Error(`Markdown service error: ${error.message || 'Unknown error'}`);
      }

      if (!data) {
        throw new Error('No response from markdown service');
      }

      if (!data.success) {
        throw new Error(data.error || 'Markdown extraction failed');
      }

      return {
        success: true,
        data: data.data
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
      // Simple test to verify the consolidated content function is accessible
      const { error } = await supabase.functions.invoke('content', {
        body: {
          action: 'markdown-extract',
          payload: {
            selectedContent: []
          }
        }
      });

      // We expect this to succeed (empty results are valid)
      return !error || error.message?.includes('authorization');
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
