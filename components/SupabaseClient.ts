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

// Chrome extension storage adapter (shares session with extension)
// Extension ID (stable when using key in manifest.json)
const EXTENSION_ID = 'ibkpiakkaphbgmafokndbkllndmdaelg';

// Detect if chrome.runtime.sendMessage is available (enabled via externally_connectable)
const isChromeExtensionAvailable = typeof chrome !== 'undefined' &&
                                   chrome.runtime &&
                                   typeof chrome.runtime.sendMessage === 'function';

const chromeStorageAdapter = isChromeExtensionAvailable ? {
  getItem: async (key: string) => {
    console.log('[Supabase] Extension getItem:', key);
    try {
      const response = await chrome.runtime.sendMessage(EXTENSION_ID, { action: 'storage-get', key });
      console.log('[Supabase] Extension getItem response received:', typeof response, response);
      // Unwrap if response is wrapped in { value: ... }
      return response?.value ?? response ?? null;
    } catch (error) {
      console.error('[Supabase] Extension getItem error:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    console.log('[Supabase] Extension setItem:', key);
    try {
      await chrome.runtime.sendMessage(EXTENSION_ID, { action: 'storage-set', key, value });
    } catch (error) {
      console.error('[Supabase] Extension setItem error:', error);
    }
  },
  removeItem: async (key: string) => {
    console.log('[Supabase] Extension removeItem:', key);
    try {
      await chrome.runtime.sendMessage(EXTENSION_ID, { action: 'storage-remove', key });
    } catch (error) {
      console.error('[Supabase] Extension removeItem error:', error);
    }
  }
} : undefined;

// Log storage adapter configuration
if (typeof window !== 'undefined') {
  if (isChromeExtensionAvailable) {
    console.log('[Supabase] Using chrome extension for session persistence (shared storage)');
  } else {
    console.log('[Supabase] Using default localStorage for session persistence');
  }
}

// Create Supabase client with build-time configuration (will be used immediately)
// This will be the primary client instance, with build-time injected values if available
// Uses chrome.storage.local when Chrome extension API is available (shares session with extension)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // More secure and faster
    ...(chromeStorageAdapter ? { storage: chromeStorageAdapter } : {})
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

// Expose globally for iOS OAuth and JavaScript execution
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
  (window as any).createClient = createClient;
  (window as any).SUPABASE_URL = SUPABASE_URL;
  (window as any).SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
}

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
    // Check if we're in iOS app (has webkit message handlers)
    const isIOSApp = typeof (window as any).webkit !== 'undefined' &&
                     (window as any).webkit.messageHandlers &&
                     (window as any).webkit.messageHandlers.authHandler;

    let redirectTo: string;
    if (isIOSApp) {
      redirectTo = 'list://auth/success';
    } else {
      // For web browsers, use the current origin
      redirectTo = window.location.origin;
    }

    console.log("🔧 SupabaseClient: Using redirect URL:", redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo
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

export const signInWithApple = async () => {
  console.log("🔍 SupabaseClient: Starting Apple OAuth sign in...");
  try {
    // Check if we're in iOS app (has webkit message handlers)
    const isIOSApp = typeof (window as any).webkit !== 'undefined' &&
                     (window as any).webkit.messageHandlers &&
                     (window as any).webkit.messageHandlers.authHandler;

    let redirectTo: string;
    if (isIOSApp) {
      redirectTo = 'list://auth/success';
    } else {
      // For web browsers, use the current origin
      redirectTo = window.location.origin;
    }

    console.log("🔧 SupabaseClient: Using redirect URL:", redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectTo
      }
    });

    if (error) {
      console.error('❌ SupabaseClient: Apple OAuth error:', error);
      throw error;
    }

    console.log("✅ SupabaseClient: Apple OAuth initiated successfully");
    return data;
  } catch (error) {
    console.error('❌ SupabaseClient: signInWithApple failed:', error);
    throw error;
  }
};

export const signInWithSpotify = async () => {
  console.log("🔍 SupabaseClient: Starting Spotify OAuth sign in...");
  try {
    // Check if we're in iOS app (has webkit message handlers)
    const isIOSApp = typeof (window as any).webkit !== 'undefined' &&
                     (window as any).webkit.messageHandlers &&
                     (window as any).webkit.messageHandlers.authHandler;

    let redirectTo: string;
    if (isIOSApp) {
      redirectTo = 'list://auth/success';
    } else {
      // For web browsers, use the current origin
      redirectTo = window.location.origin;
    }

    console.log("🔧 SupabaseClient: Using redirect URL:", redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        redirectTo: redirectTo,
        scopes: 'playlist-read-private playlist-read-collaborative'
      }
    });

    if (error) {
      console.error('❌ SupabaseClient: Spotify OAuth error:', error);
      throw error;
    }

    console.log("✅ SupabaseClient: Spotify OAuth initiated successfully");
    return data;
  } catch (error) {
    console.error('❌ SupabaseClient: signInWithSpotify failed:', error);
    throw error;
  }
};

/**
 * Link Spotify account to currently authenticated user
 * This allows users to connect Spotify without creating a separate account
 */
export const linkSpotifyAccount = async () => {
  console.log("🔍 SupabaseClient: Starting Spotify account linking...");
  try {
    // Check if user is already authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ SupabaseClient: User must be logged in to link accounts');
      throw new Error('You must be logged in to link your Spotify account');
    }

    // Check if Spotify is already linked
    const spotifyIdentity = user.identities?.find(identity => identity.provider === 'spotify');
    if (spotifyIdentity) {
      console.log('ℹ️ SupabaseClient: Spotify account already linked');
      throw new Error('Spotify account is already linked to this account');
    }

    // Check if we're in iOS app
    const isIOSApp = typeof (window as any).webkit !== 'undefined' &&
                     (window as any).webkit.messageHandlers &&
                     (window as any).webkit.messageHandlers.authHandler;

    let redirectTo: string;
    if (isIOSApp) {
      redirectTo = 'list://auth/success';
    } else {
      redirectTo = window.location.origin;
    }

    console.log("🔧 SupabaseClient: Linking Spotify with redirect URL:", redirectTo);

    // Use linkIdentity to link Spotify to existing account
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'spotify',
      options: {
        redirectTo: redirectTo,
        scopes: 'playlist-read-private playlist-read-collaborative'
      }
    });

    if (error) {
      console.error('❌ SupabaseClient: Spotify linking error:', error);
      throw error;
    }

    console.log("✅ SupabaseClient: Spotify account linking initiated successfully");
    return data;
  } catch (error) {
    console.error('❌ SupabaseClient: linkSpotifyAccount failed:', error);
    throw error;
  }
};

/**
 * Unlink Spotify account from currently authenticated user
 */
export const unlinkSpotifyAccount = async () => {
  console.log("🔍 SupabaseClient: Starting Spotify account unlinking...");
  try {
    // Get current user and find Spotify identity
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('You must be logged in to unlink accounts');
    }

    const spotifyIdentity = user.identities?.find(identity => identity.provider === 'spotify');
    if (!spotifyIdentity) {
      throw new Error('No Spotify account is linked to this account');
    }

    console.log("🔧 SupabaseClient: Unlinking Spotify identity:", spotifyIdentity.id);

    // Unlink the identity
    const { data, error } = await supabase.auth.unlinkIdentity(spotifyIdentity);

    if (error) {
      console.error('❌ SupabaseClient: Spotify unlinking error:', error);
      throw error;
    }

    console.log("✅ SupabaseClient: Spotify account unlinked successfully");
    return data;
  } catch (error) {
    console.error('❌ SupabaseClient: unlinkSpotifyAccount failed:', error);
    throw error;
  }
};

/**
 * Link GitHub account to currently authenticated user
 * This allows users to connect GitHub for repo access in Claude Code
 */
export const linkGitHubAccount = async () => {
  console.log("🔍 SupabaseClient: Starting GitHub account linking...");
  try {
    // Check if user is already authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ SupabaseClient: User must be logged in to link accounts');
      throw new Error('You must be logged in to link your GitHub account');
    }

    // Check if GitHub is already linked
    const githubIdentity = user.identities?.find(identity => identity.provider === 'github');
    if (githubIdentity) {
      console.log('ℹ️ SupabaseClient: GitHub account already linked');
      throw new Error('GitHub account is already linked to this account');
    }

    // Check if we're in iOS app
    const isIOSApp = typeof (window as any).webkit !== 'undefined' &&
                     (window as any).webkit.messageHandlers &&
                     (window as any).webkit.messageHandlers.authHandler;

    let redirectTo: string;
    if (isIOSApp) {
      redirectTo = 'list://auth/success';
    } else {
      redirectTo = window.location.origin;
    }

    console.log("🔧 SupabaseClient: Linking GitHub with redirect URL:", redirectTo);

    // Use linkIdentity to link GitHub to existing account
    // Request 'repo' scope for full repository access (clone, push)
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'github',
      options: {
        redirectTo: redirectTo,
        scopes: 'repo'
      }
    });

    if (error) {
      console.error('❌ SupabaseClient: GitHub linking error:', error);
      throw error;
    }

    console.log("✅ SupabaseClient: GitHub account linking initiated successfully");
    return data;
  } catch (error) {
    console.error('❌ SupabaseClient: linkGitHubAccount failed:', error);
    throw error;
  }
};

/**
 * Unlink GitHub account from currently authenticated user
 */
export const unlinkGitHubAccount = async () => {
  console.log("🔍 SupabaseClient: Starting GitHub account unlinking...");
  try {
    // Get current user and find GitHub identity
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('You must be logged in to unlink accounts');
    }

    const githubIdentity = user.identities?.find(identity => identity.provider === 'github');
    if (!githubIdentity) {
      throw new Error('No GitHub account is linked to this account');
    }

    console.log("🔧 SupabaseClient: Unlinking GitHub identity:", githubIdentity.id);

    // Unlink the identity
    const { data, error } = await supabase.auth.unlinkIdentity(githubIdentity);

    if (error) {
      console.error('❌ SupabaseClient: GitHub unlinking error:', error);
      throw error;
    }

    console.log("✅ SupabaseClient: GitHub account unlinked successfully");
    return data;
  } catch (error) {
    console.error('❌ SupabaseClient: unlinkGitHubAccount failed:', error);
    throw error;
  }
};

/**
 * Get all linked identities for the current user
 */
export const getLinkedIdentities = async () => {
  console.log("🔍 SupabaseClient: Getting linked identities...");
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('❌ SupabaseClient: Error getting user:', error);
      return [];
    }

    const identities = user.identities || [];
    console.log("✅ SupabaseClient: Found", identities.length, "linked identities");
    return identities;
  } catch (error) {
    console.error('❌ SupabaseClient: getLinkedIdentities failed:', error);
    return [];
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