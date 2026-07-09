import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseConfig } from './config';

/** Supabase client for Client Components (browser). Uses the publishable
 *  anon key only — RLS is the real access-control layer. */
export function createClient() {
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  return createBrowserClient(config.url, config.anonKey);
}
