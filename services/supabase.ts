import { createClient } from '@supabase/supabase-js';

// Configuration with hardcoded keys to ensure immediate connectivity
const SUPABASE_URL = 'https://dentalapi.nationalcancercenter.click/';
const SUPABASE_ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

// Create client with proper configuration for Supabase Auth
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'dental_supabase_auth'
  },
  db: {
    schema: 'public'
  }
});

// Export URL for reference
export const supabaseUrl = SUPABASE_URL;