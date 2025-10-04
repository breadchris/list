import { test, expect } from '@playwright/test';

// Configuration
// Set this after deployment: pulumi stack output apiUrl
const LAMBDA_URL = process.env.LAMBDA_API_URL || 'https://REPLACE_AFTER_DEPLOYMENT.execute-api.us-east-1.amazonaws.com/claude-code';
const CLAUDE_CODE_ENDPOINT = LAMBDA_URL;

interface ClaudeCodeResponse {
  success: boolean;
  session_id?: string;
  messages?: any[];
  r2_url?: string;
  error?: string;
}

test.describe('Claude Code Worker - Session Creation', () => {
  test('should create new session with simple prompt', async ({ request }) => {
    const response = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'What is 2 + 2?'
      }
    });

    expect(response.ok()).toBeTruthy();

    const data: ClaudeCodeResponse = await response.json();

    expect(data.success).toBe(true);
    expect(data.session_id).toBeDefined();
    expect(data.session_id).toMatch(/^session-/);
    expect(data.messages).toBeDefined();
    expect(Array.isArray(data.messages)).toBe(true);
    expect(data.messages!.length).toBeGreaterThan(0);
    expect(data.r2_url).toBeDefined();
    expect(data.r2_url).toMatch(/^r2:\/\/claude-code-sessions\//);
  });

  test('should create session with file creation prompt', async ({ request }) => {
    const response = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'Create a file called hello.txt with the content "Hello World"'
      }
    });

    expect(response.ok()).toBeTruthy();

    const data: ClaudeCodeResponse = await response.json();

    expect(data.success).toBe(true);
    expect(data.session_id).toBeDefined();
    expect(data.messages).toBeDefined();
    expect(data.r2_url).toBeDefined();
  });

  test('should generate unique session IDs for different requests', async ({ request }) => {
    const response1 = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'Say hello'
      }
    });

    const response2 = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'Say goodbye'
      }
    });

    const data1: ClaudeCodeResponse = await response1.json();
    const data2: ClaudeCodeResponse = await response2.json();

    expect(data1.session_id).not.toBe(data2.session_id);
  });
});

test.describe('Claude Code Worker - Session Continuation', () => {
  test('should continue session with existing session_id', async ({ request }) => {
    // Create initial session
    const initialResponse = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'Create a variable x = 10'
      }
    });

    const initialData: ClaudeCodeResponse = await initialResponse.json();
    expect(initialData.success).toBe(true);
    const sessionId = initialData.session_id!;

    // Continue session
    const continueResponse = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'What is the value of x?',
        session_id: sessionId
      }
    });

    const continueData: ClaudeCodeResponse = await continueResponse.json();

    expect(continueData.success).toBe(true);
    expect(continueData.session_id).toBe(sessionId);
    expect(continueData.messages).toBeDefined();
  });

  test('should maintain context across multiple requests', async ({ request }) => {
    // Create session with file
    const createResponse = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'Create a file notes.txt with "First note"'
      }
    });

    const createData: ClaudeCodeResponse = await createResponse.json();
    const sessionId = createData.session_id!;

    // Add to the file
    const updateResponse = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'Add "Second note" to notes.txt',
        session_id: sessionId
      }
    });

    const updateData: ClaudeCodeResponse = await updateResponse.json();

    expect(updateData.success).toBe(true);
    expect(updateData.session_id).toBe(sessionId);
  });

  test('should fail with non-existent session_id', async ({ request }) => {
    const response = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'Continue work',
        session_id: 'session-nonexistent-12345'
      }
    });

    expect(response.status()).toBe(404);

    const data: ClaudeCodeResponse = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });
});

test.describe('Claude Code Worker - Error Handling', () => {
  test('should return 400 when prompt is missing', async ({ request }) => {
    const response = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {}
    });

    expect(response.status()).toBe(400);

    const data: ClaudeCodeResponse = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toContain('prompt');
  });

  test('should handle CORS preflight requests', async ({ request }) => {
    const response = await request.fetch(CLAUDE_CODE_ENDPOINT, {
      method: 'OPTIONS'
    });

    expect(response.status()).toBe(204);
    expect(response.headers()['access-control-allow-origin']).toBe('*');
    expect(response.headers()['access-control-allow-methods']).toContain('POST');
  });

  test('should reject GET requests', async ({ request }) => {
    const response = await request.get(CLAUDE_CODE_ENDPOINT);

    expect(response.status()).toBe(405);

    const data: ClaudeCodeResponse = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toContain('not allowed');
  });

  test('should reject PUT requests', async ({ request }) => {
    const response = await request.put(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'Test'
      }
    });

    expect(response.status()).toBe(405);
  });

  test('should handle invalid JSON gracefully', async ({ request }) => {
    const response = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: 'invalid json string',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Should return 500 or 400 for malformed JSON
    expect([400, 500]).toContain(response.status());
  });
});

test.describe('Claude Code Worker - Response Format', () => {
  test('should return proper JSON structure on success', async ({ request }) => {
    const response = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'Echo: test'
      }
    });

    const data: ClaudeCodeResponse = await response.json();

    // Verify all required fields are present
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('session_id');
    expect(data).toHaveProperty('messages');
    expect(data).toHaveProperty('r2_url');

    // Verify types
    expect(typeof data.success).toBe('boolean');
    expect(typeof data.session_id).toBe('string');
    expect(Array.isArray(data.messages)).toBe(true);
    expect(typeof data.r2_url).toBe('string');
  });

  test('should return proper error structure on failure', async ({ request }) => {
    const response = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        session_id: 'invalid-session-id'
      }
    });

    const data: ClaudeCodeResponse = await response.json();

    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('error');
    expect(data.success).toBe(false);
    expect(typeof data.error).toBe('string');
  });

  test('should include CORS headers in all responses', async ({ request }) => {
    const response = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'Test'
      }
    });

    const headers = response.headers();

    expect(headers['access-control-allow-origin']).toBe('*');
    expect(headers['content-type']).toContain('application/json');
  });
});

test.describe('Claude Code Worker - Integration Tests', () => {
  test('should handle code generation and execution', async ({ request }) => {
    const response = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'Write a JavaScript function that adds two numbers and save it to math.js'
      }
    });

    const data: ClaudeCodeResponse = await response.json();

    expect(data.success).toBe(true);
    expect(data.messages).toBeDefined();
    expect(data.messages!.length).toBeGreaterThan(0);
  });

  test('should handle multi-step workflow', async ({ request }) => {
    // Step 1: Create initial file
    const step1 = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'Create a file counter.txt with the number 1'
      }
    });

    const step1Data: ClaudeCodeResponse = await step1.json();
    const sessionId = step1Data.session_id!;

    // Step 2: Increment the counter
    const step2 = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'Read counter.txt, increment the number, and save it back',
        session_id: sessionId
      }
    });

    const step2Data: ClaudeCodeResponse = await step2.json();

    // Step 3: Read the result
    const step3 = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'What is the current value in counter.txt?',
        session_id: sessionId
      }
    });

    const step3Data: ClaudeCodeResponse = await step3.json();

    expect(step3Data.success).toBe(true);
    expect(step3Data.session_id).toBe(sessionId);
  });

  test('should handle session with complex file structure', async ({ request }) => {
    const response = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'Create a project structure with: src/main.js, src/utils.js, and README.md'
      }
    });

    const data: ClaudeCodeResponse = await response.json();

    expect(data.success).toBe(true);
    expect(data.r2_url).toBeDefined();
  });
});

test.describe('Claude Code Worker - Performance', () => {
  test('should respond within reasonable time for simple prompts', async ({ request }) => {
    const startTime = Date.now();

    const response = await request.post(CLAUDE_CODE_ENDPOINT, {
      data: {
        prompt: 'What is 1 + 1?'
      }
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(response.ok()).toBeTruthy();
    // Should respond within 30 seconds for simple prompts
    expect(duration).toBeLessThan(30000);
  });

  test('should handle concurrent requests', async ({ request }) => {
    const promises = [
      request.post(CLAUDE_CODE_ENDPOINT, {
        data: { prompt: 'Calculate 1 + 1' }
      }),
      request.post(CLAUDE_CODE_ENDPOINT, {
        data: { prompt: 'Calculate 2 + 2' }
      }),
      request.post(CLAUDE_CODE_ENDPOINT, {
        data: { prompt: 'Calculate 3 + 3' }
      })
    ];

    const responses = await Promise.all(promises);

    // All should succeed
    for (const response of responses) {
      expect(response.ok()).toBeTruthy();
      const data: ClaudeCodeResponse = await response.json();
      expect(data.success).toBe(true);
    }

    // All should have unique session IDs
    const sessionIds = await Promise.all(
      responses.map(async r => {
        const data: ClaudeCodeResponse = await r.json();
        return data.session_id;
      })
    );

    const uniqueIds = new Set(sessionIds);
    expect(uniqueIds.size).toBe(3);
  });
});
