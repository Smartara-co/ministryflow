import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { Profile, Role } from './types';

export interface SessionInfo {
  userId: string;
  email: string | null;
  profile: Profile;
}

/** The signed-in user's profile, or null when signed out. Throws if Supabase
 *  env vars are missing — that is a deployment error, not a sign-in state. */
export async function getSessionProfile(): Promise<SessionInfo | null> {
  const supabase = await createClient();
  if (!supabase) {
    throw new Error(
      'Supabase is not configured — copy .env.example to .env.local and fill it in.',
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (!profile) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile as Profile,
  };
}

/** Layout guard: redirects to sign-in when signed out, or to the caller's
 *  own home when their role doesn't match. RLS is the real enforcement —
 *  this only keeps navigation coherent. */
export async function requireRole(...roles: Role[]): Promise<SessionInfo> {
  const session = await getSessionProfile();
  if (!session) redirect('/sign-in');
  if (!roles.includes(session.profile.role)) {
    redirect(homePathForRole(session.profile.role));
  }
  return session;
}

export function homePathForRole(role: Role): string {
  switch (role) {
    case 'ministry_admin':
      return '/admin';
    case 'super_admin':
      return '/super-admin';
    default:
      return '/dashboard';
  }
}
