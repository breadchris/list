import { Content } from './ContentRepository';

const WORKER_URL = 'https://content-worker.chrislegolife.workers.dev/claude-code';

export interface ClaudeCodeRequest {
  prompt: string;
  session_id?: string;
}

export interface ClaudeCodeResponse {
  success: boolean;
  session_id?: string;
  messages?: any[];
  r2_url?: string;
  error?: string;
}

export interface ClaudeCodeSessionMetadata {
  session_id: string;
  r2_url: string;
  initial_prompt: string;
  created_at: string;
  last_updated_at?: string;
}

export class ClaudeCodeService {

  /**
   * Execute Claude Code with a prompt and optional session continuation
   */
  static async executeClaudeCode(
    prompt: string,
    sessionId?: string
  ): Promise<ClaudeCodeResponse> {
    try {
      // Validate input
      if (!prompt?.trim()) {
        throw new Error('Prompt is required');
      }

      const requestBody: ClaudeCodeRequest = {
        prompt: prompt.trim()
      };

      // Add session_id if continuing an existing session
      if (sessionId) {
        requestBody.session_id = sessionId;
      }

      console.log('Calling Claude Code worker:', WORKER_URL, requestBody);

      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Worker error (${response.status}): ${errorText}`);
      }

      const data: ClaudeCodeResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Claude Code execution failed');
      }

      console.log('Claude Code worker response:', data);

      return data;

    } catch (error) {
      console.error('Claude Code Service error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Create session metadata object for storage in content
   */
  static createSessionMetadata(
    sessionId: string,
    r2Url: string,
    initialPrompt: string,
    isUpdate: boolean = false
  ): ClaudeCodeSessionMetadata {
    const metadata: ClaudeCodeSessionMetadata = {
      session_id: sessionId,
      r2_url: r2Url,
      initial_prompt: initialPrompt,
      created_at: new Date().toISOString()
    };

    if (isUpdate) {
      metadata.last_updated_at = new Date().toISOString();
    }

    return metadata;
  }

  /**
   * Extract session metadata from content
   */
  static getSessionFromContent(content: Content): ClaudeCodeSessionMetadata | null {
    if (!content.metadata?.claude_code_session) {
      return null;
    }

    const session = content.metadata.claude_code_session as ClaudeCodeSessionMetadata;

    // Validate required fields
    if (!session.session_id || !session.r2_url) {
      return null;
    }

    return session;
  }

  /**
   * Format prompt preview for display
   */
  static formatPromptPreview(prompt: string, maxLength: number = 100): string {
    if (prompt.length <= maxLength) {
      return prompt;
    }
    return prompt.substring(0, maxLength) + '...';
  }

  /**
   * Validate prompt input
   */
  static validatePrompt(prompt: string): { isValid: boolean; error?: string } {
    if (!prompt || !prompt.trim()) {
      return { isValid: false, error: 'Prompt cannot be empty' };
    }

    if (prompt.trim().length < 3) {
      return { isValid: false, error: 'Prompt must be at least 3 characters long' };
    }

    if (prompt.length > 10000) {
      return { isValid: false, error: 'Prompt must be less than 10000 characters' };
    }

    return { isValid: true };
  }
}

export default ClaudeCodeService;
