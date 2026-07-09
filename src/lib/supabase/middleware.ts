import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig, hasSupabaseEnvVars } from './config';

/** Refreshes the auth session on every request (expired tokens are renewed
 *  and the cookies propagated to both the server and the browser). Called
 *  from src/proxy.ts. Route-level authorization will be layered on top
 *  when the UI is built; RLS protects the data regardless. */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Not configured yet (no .env.local): skip session handling instead of
  // crashing every request. There is no session to refresh without a
  // Supabase project, and data access fails loudly on its own.
  const config = getSupabaseConfig();
  if (!config || !hasSupabaseEnvVars()) {
    console.warn(
      'Supabase env vars missing — copy .env.example to .env.local and fill them in.',
    );
    return supabaseResponse;
  }

  const supabase = createServerClient(config.url, config.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not remove: getUser() revalidates the token with Supabase Auth and is
  // what actually keeps the session fresh.
  await supabase.auth.getUser();

  return supabaseResponse;
}
