import { supabase } from './SupabaseClient';

export interface ChatRequest {
  chat_content_id: string;  // Parent chat content ID
  message: string;
  group_id: string;
}

export interface ChatResponse {
  success: boolean;
  assistant_message?: string;
  error?: string;
}

export class ChatService {

  static async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      // Validate input
      if (!request.message?.trim()) {
        throw new Error('Message is required');
      }

      if (!request.chat_content_id) {
        throw new Error('Chat content ID is required');
      }

      if (!request.group_id) {
        throw new Error('Group ID is required');
      }

      // Call the consolidated content function with chat-message action
      const { data, error } = await supabase.functions.invoke('content', {
        body: {
          action: 'chat-message',
          payload: {
            chat_content_id: request.chat_content_id,
            message: request.message,
            group_id: request.group_id
          }
        }
      });

      if (error) {
        console.error('Edge Function error:', error);
        throw new Error(`Chat service error: ${error.message || 'Unknown error'}`);
      }

      if (!data) {
        throw new Error('No response from chat service');
      }

      if (!data.success) {
        throw new Error(data.error || 'Chat message failed');
      }

      return {
        success: true,
        assistant_message: data.assistant_message
      };

    } catch (error) {
      console.error('Chat Service error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  static async testConnection(): Promise<boolean> {
    try {
      // Simple test to verify the chat-message action is accessible
      const { error } = await supabase.functions.invoke('content', {
        body: {
          action: 'chat-message',
          payload: {
            chat_content_id: 'test',
            message: 'test',
            group_id: 'test'
          }
        }
      });

      // We expect this to fail with validation error, but if function is accessible
      // the error should be about missing/invalid data, not about function not found
      return error?.message?.includes('chat_content_id') ||
             error?.message?.includes('authorization') ||
             error?.message?.includes('Missing or invalid');
    } catch (error) {
      console.error('Chat Service connection test failed:', error);
      return false;
    }
  }

  static formatMessagePreview(message: string, maxLength: number = 100): string {
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength) + '...';
  }

  static validateMessage(message: string): { isValid: boolean; error?: string } {
    if (!message || !message.trim()) {
      return { isValid: false, error: 'Message cannot be empty' };
    }

    if (message.trim().length < 1) {
      return { isValid: false, error: 'Message must be at least 1 character long' };
    }

    if (message.length > 4000) {
      return { isValid: false, error: 'Message must be less than 4000 characters' };
    }

    return { isValid: true };
  }
}

export default ChatService;
