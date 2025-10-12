import { Content } from './ContentRepository';
import { LambdaClient } from './LambdaClient';

export interface ClaudeCodeRequest {
  prompt: string;
  session_id?: string;
}

export interface ClaudeCodeResponse {
  success: boolean;
  session_id?: string;
  messages?: any[];
  s3_url?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

export interface ClaudeCodeJobResponse {
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  created_at: string;
  result?: ClaudeCodeResponse;
  error?: string;
}

export interface ClaudeCodeSessionMetadata {
  session_id: string;
  s3_url?: string;
  r2_url?: string; // Deprecated - kept for backward compatibility
  initial_prompt: string;
  created_at: string;
  last_updated_at?: string;
}

export class ClaudeCodeService {

  /**
   * Format selected content for Claude Code context
   */
  static formatSelectedContentForContext(selectedContent: Content[]): string {
    if (!selectedContent || selectedContent.length === 0) {
      return '';
    }

    const formattedItems = selectedContent.map((item, index) => {
      const metadata = item.metadata ? `\nMetadata: ${JSON.stringify(item.metadata, null, 2)}` : '';
      return `Content Item ${index + 1}:
Type: ${item.type}
Data: ${item.data}${metadata}`;
    }).join('\n---\n');

    return `<selected_content>
${formattedItems}
</selected_content>

`;
  }

  /**
   * Execute Claude Code with a prompt and optional session continuation
   * Uses async job pattern with polling
   */
  static async executeClaudeCode(
    prompt: string,
    sessionId?: string,
    selectedContent?: Content[],
    onProgress?: (status: string) => void
  ): Promise<ClaudeCodeResponse> {
    try {
      // Validate input
      if (!prompt?.trim()) {
        throw new Error('Prompt is required');
      }

      // Format selected content and prepend to prompt if provided
      let fullPrompt = prompt.trim();
      if (selectedContent && selectedContent.length > 0) {
        const contextString = this.formatSelectedContentForContext(selectedContent);
        fullPrompt = contextString + fullPrompt;
      }

      const requestPayload: ClaudeCodeRequest = {
        prompt: fullPrompt
      };

      // Add session_id if continuing an existing session
      if (sessionId) {
        requestPayload.session_id = sessionId;
      }

      console.log('Submitting Claude Code job via /content endpoint:', requestPayload);
      onProgress?.('Submitting job...');

      // Submit job and get job_id
      const jobResponse = await LambdaClient.invoke({
        action: 'claude-code',
        payload: requestPayload
      });

      if (!jobResponse.success && !jobResponse.job_id) {
        throw new Error(jobResponse.error || 'Failed to submit Claude Code job');
      }

      const jobData = jobResponse as unknown as ClaudeCodeJobResponse;
      const job_id = jobData.job_id;

      console.log('Job submitted:', job_id);
      onProgress?.(`Job ${job_id.substring(0, 12)}... submitted`);

      // Poll for completion
      const result = await this.pollJobStatus(job_id, onProgress);

      return result;

    } catch (error) {
      console.error('Claude Code Service error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Poll job status until completion or error
   * Implements exponential backoff polling strategy
   */
  static async pollJobStatus(
    job_id: string,
    onProgress?: (status: string) => void
  ): Promise<ClaudeCodeResponse> {
    const startTime = Date.now();
    const maxAttempts = 150; // 5 minutes total with varying intervals
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;

      // Calculate polling interval with exponential backoff
      let intervalMs: number;
      if (attempt <= 10) {
        // First 10 attempts: 1 second intervals
        intervalMs = 1000;
      } else if (attempt <= 30) {
        // Next 20 attempts: 2 second intervals
        intervalMs = 2000;
      } else {
        // Remaining attempts: 5 second intervals
        intervalMs = 5000;
      }

      // Wait before polling (except first attempt)
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }

      try {
        // Check job status
        const statusResponse = await LambdaClient.invoke({
          action: 'claude-code-status',
          payload: { job_id }
        });

        if (!statusResponse.success) {
          // Job not found or error checking status
          if (attempt < 5) {
            // Retry a few times for transient errors
            continue;
          }
          throw new Error(statusResponse.error || 'Failed to check job status');
        }

        const jobStatus = statusResponse as unknown as ClaudeCodeJobResponse;
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

        console.log(`[Attempt ${attempt}] Job ${job_id} status: ${jobStatus.status} (${elapsedSeconds}s elapsed)`);

        // Update progress
        if (jobStatus.status === 'pending') {
          onProgress?.(`Waiting for execution... (${elapsedSeconds}s)`);
        } else if (jobStatus.status === 'running') {
          onProgress?.(`Executing Claude Code... (${elapsedSeconds}s)`);
        } else if (jobStatus.status === 'completed') {
          onProgress?.('Execution completed!');

          if (!jobStatus.result) {
            throw new Error('Job completed but no result available');
          }

          return jobStatus.result;
        } else if (jobStatus.status === 'error') {
          throw new Error(jobStatus.error || 'Job execution failed');
        }

      } catch (error) {
        console.error('Error polling job status:', error);

        // If we're early in polling, retry
        if (attempt < 5) {
          continue;
        }

        // Otherwise throw
        throw error;
      }
    }

    // Timeout
    throw new Error('Job execution timed out after 5 minutes');
  }

  /**
   * Create session metadata object for storage in content
   */
  static createSessionMetadata(
    sessionId: string,
    s3Url: string,
    initialPrompt: string,
    isUpdate: boolean = false
  ): ClaudeCodeSessionMetadata {
    const metadata: ClaudeCodeSessionMetadata = {
      session_id: sessionId,
      s3_url: s3Url,
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

    // Validate required fields - support both s3_url (new) and r2_url (legacy)
    if (!session.session_id || (!session.s3_url && !session.r2_url)) {
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
