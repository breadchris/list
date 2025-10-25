import { Content, ContentRepository, SerializedContent } from './ContentRepository';
import { LambdaClient } from './LambdaClient';
import { supabase } from './SupabaseClient';

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
  input_content_ids?: string[]; // IDs of input content to be stored in metadata
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
  input_content_ids?: string[]; // IDs of content tagged with "input" for TSX component props
  github_repo?: {
    owner: string;
    name: string;
    branch: string;
  };
  git_commit_sha?: string;
  git_commit_url?: string;
}

const CLAUDE_CODE_BASE_PROMPT = `You will only create tsx components that have no backend. They will only use react and no other external dependencies.

All dependencies will use esm.sh syntax:
\`\`\`
import React from "https://esm.sh/react"; // latest
import React from "https://esm.sh/react@18"; // 18.2.0
import React from "https://esm.sh/react@next"; // next tag
import { renderToString } from "https://esm.sh/react-dom/server"; // sub-modules
\`\`\`

CRITICAL: The component will only ever be written to one file in the CURRENT WORKING DIRECTORY.
- You MUST write files with RELATIVE paths only (e.g., "Counter.tsx")
- DO NOT use absolute paths starting with "/" (e.g., "/tmp/Counter.tsx" is WRONG)
- DO NOT write to /tmp/ directory directly
- Write directly to the current working directory using just the filename

Example: Use Write tool with file_path: "Counter.tsx" (not "/tmp/Counter.tsx")

`;

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
   * Format serialized input content for Claude Code component props
   */
  static formatInputContentForPrompt(serializedContent: SerializedContent[]): string {
    if (!serializedContent || serializedContent.length === 0) {
      return '';
    }

    const jsonContent = JSON.stringify(serializedContent, null, 2);

    return `This is serialized content that will be passed into the tsx component at runtime as props. When writing the tsx component, consider how this content will be processed and used in the component. For example, if the provided content describes a recipe, and the requested app is a recipe viewer, the provided content will be used when rendering the recipe view.

<input_content>
${jsonContent}
</input_content>

`;
  }

  /**
   * Execute Claude Code with a prompt and optional session continuation
   * Uses async job pattern with polling
   */
  static async executeClaudeCode(
    prompt: string,
    groupId: string,
    sessionId?: string,
    selectedContent?: Content[],
    parentContentId?: string,
    onProgress?: (status: string) => void,
    githubRepo?: {
      owner: string;
      name: string;
      branch: string;
    }
  ): Promise<ClaudeCodeResponse> {
    try {
      // Validate input
      if (!prompt?.trim()) {
        throw new Error('Prompt is required');
      }

      if (!groupId) {
        throw new Error('Group ID is required');
      }

      // Track input content IDs for metadata storage
      const inputContentIds: string[] = [];
      let inputContentString = '';

      // Filter selected content for "input" tag and serialize
      if (selectedContent && selectedContent.length > 0) {
        const inputContent = selectedContent.filter(item =>
          item.tags?.some(tag => tag.name.toLowerCase() === 'input')
        );

        if (inputContent.length > 0) {
          // Serialize each input content item with its children
          const repository = new ContentRepository();
          const serializedContent: SerializedContent[] = [];

          for (const item of inputContent) {
            try {
              const serialized = await repository.serializeContentWithChildren(item.id);
              serializedContent.push(serialized);
              inputContentIds.push(item.id);
            } catch (error) {
              console.error(`Failed to serialize input content ${item.id}:`, error);
              // Continue with other items even if one fails
            }
          }

          // Format serialized content for prompt
          if (serializedContent.length > 0) {
            inputContentString = this.formatInputContentForPrompt(serializedContent);
          }
        }
      }

      // Prepend base prompt to all Claude Code executions
      let fullPrompt = CLAUDE_CODE_BASE_PROMPT + inputContentString;

      // Format remaining selected content (non-input items) and add if provided
      if (selectedContent && selectedContent.length > 0) {
        const nonInputContent = selectedContent.filter(item =>
          !item.tags?.some(tag => tag.name.toLowerCase() === 'input')
        );
        if (nonInputContent.length > 0) {
          const contextString = this.formatSelectedContentForContext(nonInputContent);
          fullPrompt += contextString;
        }
      }

      // Add user prompt at the end
      fullPrompt += prompt.trim();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const requestPayload: any = {
        prompt: fullPrompt,
        user_id: user.id,
        group_id: groupId,
        parent_content_id: parentContentId || null
      };

      // Add session_id if continuing an existing session
      if (sessionId) {
        requestPayload.session_id = sessionId;
      }

      // Add GitHub repo integration if provided
      if (githubRepo) {
        // Get GitHub token from user identities
        const githubIdentity = user.identities?.find(identity => identity.provider === 'github');

        if (githubIdentity) {
          // Access token is stored in identity_data
          const githubToken = (githubIdentity.identity_data as any)?.provider_token;

          if (githubToken) {
            requestPayload.github_repo = {
              owner: githubRepo.owner,
              name: githubRepo.name,
              branch: githubRepo.branch,
              token: githubToken
            };
          } else {
            console.warn('GitHub token not found in identity, proceeding without git integration');
          }
        } else {
          console.warn('GitHub not linked, proceeding without git integration');
        }
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

      // Add input_content_ids to result for metadata storage
      if (inputContentIds.length > 0) {
        result.input_content_ids = inputContentIds;
      }

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
        // Check job status using get-job action
        const statusResponse = await LambdaClient.invoke({
          action: 'get-job',
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

        // Extract job data from response
        const jobData = statusResponse.job;
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

        console.log(`[Attempt ${attempt}] Job ${job_id} status: ${jobData.status} (${elapsedSeconds}s elapsed)`);

        // Update progress
        if (jobData.status === 'pending') {
          onProgress?.(`Waiting for execution... (${elapsedSeconds}s)`);
        } else if (jobData.status === 'processing') {
          onProgress?.(`Executing Claude Code... (${elapsedSeconds}s)`);
        } else if (jobData.status === 'completed') {
          onProgress?.('Execution completed!');

          if (!jobData.result) {
            throw new Error('Job completed but no result available');
          }

          return jobData.result;
        } else if (jobData.status === 'failed') {
          throw new Error(jobData.error || 'Job execution failed');
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
    isUpdate: boolean = false,
    inputContentIds?: string[]
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

    if (inputContentIds && inputContentIds.length > 0) {
      metadata.input_content_ids = inputContentIds;
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
