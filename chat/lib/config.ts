/**
 * Application configuration from environment variables
 * These values correspond to the config.go configuration in the original list project
 */
export const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  lambdaEndpoint: process.env.NEXT_PUBLIC_LAMBDA_ENDPOINT!,
  tellerApplicationId: process.env.NEXT_PUBLIC_TELLER_APPLICATION_ID!,
  tellerEnvironment: process.env.NEXT_PUBLIC_TELLER_ENVIRONMENT!,
};

/**
 * Validates that all required environment variables are set
 * Call this during app initialization to catch configuration errors early
 */
export function validateConfig(): void {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_LAMBDA_ENDPOINT',
  ] as const;

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}
