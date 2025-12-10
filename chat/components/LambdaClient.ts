// Lambda client for calling the content API
// Replaces Supabase Edge Function calls with Lambda endpoint

// Use Next.js public environment variable directly
const LAMBDA_ENDPOINT = process.env.NEXT_PUBLIC_LAMBDA_ENDPOINT;

export interface LambdaRequest {
  action: string;
  payload: any;
  sync?: boolean; // When true, execute immediately and return results. When false/omitted, queue job and return job_id (default)
}

export interface LambdaResponse {
  success: boolean;
  data?: any;
  error?: string;
  queued?: boolean;
}

export class LambdaClient {
  /**
   * Invoke the Lambda content endpoint
   * @param request The request containing action and payload
   * @returns Response from Lambda
   */
  static async invoke(request: LambdaRequest): Promise<LambdaResponse> {
    try {
      if (!LAMBDA_ENDPOINT) {
        throw new Error("Lambda endpoint not configured - set NEXT_PUBLIC_LAMBDA_ENDPOINT");
      }

      const response = await fetch(LAMBDA_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Lambda request failed: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Lambda client error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Test if the Lambda endpoint is accessible
   */
  static async testConnection(): Promise<boolean> {
    try {
      if (!LAMBDA_ENDPOINT) {
        return false;
      }

      const response = await fetch(LAMBDA_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "seo-extract",
          payload: { selectedContent: [] },
        }),
      });

      // If we get any response (even an error), the endpoint is accessible
      return response.status < 500;
    } catch (error) {
      console.error("Lambda connection test failed:", error);
      return false;
    }
  }
}

export default LambdaClient;
