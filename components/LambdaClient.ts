// Lambda client for calling the content API
// Replaces Supabase Edge Function calls with Lambda endpoint

const LAMBDA_ENDPOINT = 'https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/content';

export interface LambdaRequest {
  action: string;
  payload: any;
}

export interface LambdaResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class LambdaClient {
  /**
   * Invoke the Lambda content endpoint
   * @param request The request containing action and payload
   * @returns Response from Lambda
   */
  static async invoke(request: LambdaRequest): Promise<LambdaResponse> {
    try {
      const response = await fetch(LAMBDA_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Lambda request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Lambda client error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Test if the Lambda endpoint is accessible
   */
  static async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(LAMBDA_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'seo-extract',
          payload: { selectedContent: [] }
        }),
      });

      // If we get any response (even an error), the endpoint is accessible
      return response.status < 500;
    } catch (error) {
      console.error('Lambda connection test failed:', error);
      return false;
    }
  }
}

export default LambdaClient;
