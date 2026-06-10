import { createClient } from '@supabase/supabase-js';

// Configuration with hardcoded keys to ensure immediate connectivity
const SUPABASE_URL = 'https://supabasemydentist.dentalcloud.asia';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijg2Y2I0NDFhLWQ0MDAtNDQxNy1iMTUyLWQ0MWNkYmRhYTAzNCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgwOTc2NzQ3LCJleHAiOjE5Mzg2NTY3NDd9.gButNeKN2_SVxen0M8h4lyBbVnxqcH_Yw7FOkUtkOjLPQmhtQObSNtsbuLBVzMchbVg0Vmktw_41VwC1EG1FTQ';

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

// Export URL and key for reference
export const supabaseUrl = SUPABASE_URL;
export const supabaseAnonKey = SUPABASE_ANON_KEY;