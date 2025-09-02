import { createClient } from '@supabase/supabase-js';

// Configuration - these values may be injected at build time by the Go server
const SUPABASE_URL = 'https://zazsrepfnamdmibcyenx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphenNyZXBmbmFtZG1pYmN5ZW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTYyNzMsImV4cCI6MjA3MDg3MjI3M30.IG4pzHdSxcbxCtonJ2EiczUDFeR5Lh41CI9MU2YrciM';

// Runtime configuration cache
let runtimeConfig: { supabase_url: string; supabase_key: string } | null = null;

// Fetch configuration from server if needed
const fetchRuntimeConfig = async (): Promise<{ supabase_url: string; supabase_key: string }> => {
  if (runtimeConfig) {
    return runtimeConfig;
  }

  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status}`);
    }
    runtimeConfig = await response.json();
    return runtimeConfig!;
  } catch (error) {
    console.warn('Failed to fetch runtime config, using build-time values:', error);
    return {
      supabase_url: SUPABASE_URL,
      supabase_key: SUPABASE_ANON_KEY
    };
  }
};

// Get effective configuration (runtime or build-time)
const getSupabaseConfig = async () => {
  const config = await fetchRuntimeConfig();
  return {
    url: config.supabase_url,
    key: config.supabase_key
  };
};

// Validate configuration
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase configuration: SUPABASE_URL and SUPABASE_ANON_KEY are required');
}

// Create Supabase client with build-time configuration (will be used immediately)
// This will be the primary client instance, with build-time injected values if available
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce' // More secure and faster
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'cache-control': 'no-cache'
    }
  }
});

// For future extensibility: function to create a client with runtime config
export const createSupabaseClientWithConfig = async () => {
  const config = await getSupabaseConfig();
  return createClient(config.url, config.key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },
    global: {
      headers: {
        'cache-control': 'no-cache'
      }
    }
  });
};

export const signInWithGoogle = async () => {
  console.log("🔍 SupabaseClient: Starting Google OAuth sign in...");
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    
    if (error) {
      console.error('❌ SupabaseClient: Google OAuth error:', error);
      throw error;
    }
    
    console.log("✅ SupabaseClient: Google OAuth initiated successfully");
    return data;
  } catch (error) {
    console.error('❌ SupabaseClient: signInWithGoogle failed:', error);
    throw error;
  }
};

// Helper function to create timeout wrapper with exponential backoff
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

// Fast session check (uses cached session with timeout)
export const getFastSession = async () => {
  try {
    const { data: { session }, error } = await withTimeout(
      supabase.auth.getSession(), 
      2000 // 2 second timeout
    );
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('Fast session check failed:', error);
    return null;
  }
};

// Helper functions for auth - optimized with shorter timeout
export const getCurrentUser = async () => {
  console.log("🔍 SupabaseClient: Getting current user...");
  try {
    const { data: { user }, error } = await withTimeout(supabase.auth.getUser(), 3000);
    if (error) {
      console.error('❌ SupabaseClient: Error getting current user:', error);
      throw error;
    }
    console.log("✅ SupabaseClient: Current user retrieved:", user ? "Found" : "None");
    return user;
  } catch (error) {
    console.error('❌ SupabaseClient: getCurrentUser failed:', error);
    throw error;
  }
};

export const getCurrentSession = async () => {
  console.log("🔍 SupabaseClient: Getting current session...");
  try {
    const { data: { session }, error } = await withTimeout(supabase.auth.getSession(), 2000);
    if (error) {
      console.error('❌ SupabaseClient: Error getting current session:', error);
      throw error;
    }
    console.log("✅ SupabaseClient: Current session retrieved:", session ? "Found" : "None");
    return session;
  } catch (error) {
    console.error('❌ SupabaseClient: getCurrentSession failed:', error);
    throw error;
  }
};

// Database health check - optimized with faster timeout
export const checkDatabaseHealth = async (): Promise<{ healthy: boolean; error?: string }> => {
  try {
    console.log("🏥 SupabaseClient: Checking database health...");
    
    // Simple query to test database connectivity with shorter timeout
    const { data, error } = await withTimeout(
      supabase.from('users').select('id').limit(1), 
      2000
    );
    
    if (error) {
      console.error('❌ SupabaseClient: Database health check failed:', error);
      return { healthy: false, error: error.message };
    }
    
    console.log("✅ SupabaseClient: Database is healthy");
    return { healthy: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ SupabaseClient: Database health check error:', message);
    return { healthy: false, error: message };
  }
};

// Retry helper for failed operations
export const withRetry = async <T>(
  operation: () => Promise<T>, 
  maxRetries: number = 2,
  delayMs: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries + 1) {
        throw error;
      }
      
      console.warn(`Operation failed (attempt ${attempt}/${maxRetries + 1}), retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 1.5; // Exponential backoff
    }
  }
  throw new Error('Retry logic error');
};