import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { webEnv } from '../config/env';

let supabaseClient: SupabaseClient | null = null;

export function isSupabaseAuthConfigured() {
  return Boolean(webEnv.supabaseUrl && webEnv.supabaseAnonKey);
}

export function getSupabaseClient() {
  if (!isSupabaseAuthConfigured()) {
    return null;
  }

  supabaseClient ??= createClient(webEnv.supabaseUrl, webEnv.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true
    }
  });

  return supabaseClient;
}
