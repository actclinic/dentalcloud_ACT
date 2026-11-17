import { createClient } from '@supabase/supabase-js';
import { backendConnection } from './backendConnection';
import { createCredentialFetch } from './credentialTransport';

// In production, use the same-origin nginx gateway so browser API requests do
// not depend on Cloudflare's handling of cross-origin OPTIONS preflights.
const SUPABASE_URL = typeof window !== 'undefined'
  ? `${window.location.origin}/supabase`
  : 'https://supabaseact.dentalcloud.asia';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgzOTIwMTM5LCJleHAiOjQxMDI0NDQ3OTl9.sWZxqAefSfaaAepGZ8VI4OIG3FVgt0rjAxpYvqamMnk';

backendConnection.configure(SUPABASE_URL, globalThis.fetch.bind(globalThis));
const credentialFetch = createCredentialFetch(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  backendConnection.fetch.bind(backendConnection)
);

// Create client with proper configuration for Supabase Auth
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: credentialFetch
  },
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
