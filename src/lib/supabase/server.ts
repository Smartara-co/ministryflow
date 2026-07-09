import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './config';

/** Supabase client for Server Components, Server Actions, and Route
 *  Handlers. Acts as the signed-in user (anon key + session cookie), so RLS
 *  applies to every query. */
export async function createClient() {
  const cookieStore = await cookies();
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  return createServerClient(config.url, config.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies can't be set.
            // Safe to ignore when middleware is refreshing sessions.
          }
        },
      },
    },
  );
}
