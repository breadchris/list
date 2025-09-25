import { FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

async function globalSetup(config: FullConfig) {
  console.log('🧪 Setting up global test environment...');

  // Wait for Supabase to be ready
  const supabase = createClient(
    'http://127.0.0.1:54321',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  );

  // Test database connection
  try {
    const { error } = await supabase.from('groups').select('count').limit(1).single();
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw error;
    }
    console.log('✅ Supabase connection established');
  } catch (error) {
    console.error('❌ Failed to connect to Supabase:', error);
    throw error;
  }

  // Clean up any existing test data
  await cleanupTestData(supabase);

  console.log('✅ Global setup completed');
}

async function cleanupTestData(supabase: any) {
  try {
    // Clean up test data - in this case, we don't need to clean auth.users
    // as Supabase handles that, but we can clean other test data if needed
    console.log('🧹 Cleaning test data...');
  } catch (error) {
    console.warn('Warning during test data cleanup:', error);
  }
}

export default globalSetup;