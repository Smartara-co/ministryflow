import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** PKCE code exchange for email confirmation, admin invites, and password
 *  recovery links. `next` decides where the user lands afterwards. */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(
    `${origin}/sign-in?error=Could not verify the link — it may have expired.`,
  );
}
