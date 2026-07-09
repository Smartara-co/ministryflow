import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminConfig } from './config';

/** Service-role client — BYPASSES RLS. Server-side only (the `server-only`
 *  import makes any client-bundle inclusion a build error).
 *
 *  Use exclusively for operations that genuinely need elevated access:
 *  inviting ministry admins, assigning roles, system jobs. Everything
 *  user-facing must go through `server.ts`/`client.ts` so RLS applies. */
export function createAdminClient() {
  const config = getSupabaseAdminConfig();

  if (!config) {
    return null;
  }

  return createSupabaseClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
