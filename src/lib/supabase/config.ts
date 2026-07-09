/** Env access for Supabase clients.
 *
 *  IMPORTANT: NEXT_PUBLIC_* vars must be referenced as literal
 *  `process.env.NEXT_PUBLIC_X` expressions — Next.js inlines them into the
 *  client bundle by static text replacement at build time. A dynamic lookup
 *  like `process.env[name]` is only resolvable on the server and comes back
 *  undefined in the browser. */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined;

export function hasSupabaseEnvVars(): boolean {
  return Boolean(url && anonKey);
}

export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Server-only: the service role key is never exposed to the client bundle
 *  (no NEXT_PUBLIC_ prefix), so this returns null in the browser by design. */
export function getSupabaseAdminConfig(): {
  url: string;
  serviceRoleKey: string;
} | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}
