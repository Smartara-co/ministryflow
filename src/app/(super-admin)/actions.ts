'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

async function requireSuperAdmin() {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== 'super_admin') return null;
  return session;
}

export async function addMinistry(formData: FormData): Promise<ActionResult> {
  if (!(await requireSuperAdmin())) return { ok: false, message: 'Not authorized.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: 'Not configured.' };

  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  if (!name || !code) return { ok: false, message: 'Name and code are required.' };

  const { error } = await supabase.from('ministries').insert({ name, code });
  if (error) return { ok: false, message: error.message };

  revalidatePath('/super-admin');
  return { ok: true, message: `${name} added.` };
}

export async function addDepartment(formData: FormData): Promise<ActionResult> {
  if (!(await requireSuperAdmin())) return { ok: false, message: 'Not authorized.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: 'Not configured.' };

  const ministryId = String(formData.get('ministry_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!ministryId || !name) {
    return { ok: false, message: 'Ministry and department name are required.' };
  }

  const { error } = await supabase
    .from('departments')
    .insert({ ministry_id: ministryId, name });
  if (error) return { ok: false, message: error.message };

  revalidatePath('/super-admin');
  return { ok: true, message: `${name} added.` };
}

/** Invite a ministry admin: Supabase sends the invite email; the profile row
 *  (created by the signup trigger) is then promoted with the service-role
 *  client — the one operation RLS can't do for us. */
export async function inviteMinistryAdmin(formData: FormData): Promise<ActionResult> {
  if (!(await requireSuperAdmin())) return { ok: false, message: 'Not authorized.' };

  const admin = createAdminClient();
  if (!admin) return { ok: false, message: 'Service role key is not configured.' };

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const ministryId = String(formData.get('ministry_id') ?? '');
  if (!email || !ministryId) {
    return { ok: false, message: 'Email and ministry are required.' };
  }

  const headerList = await headers();
  const origin = headerList.get('origin');

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    ...(origin ? { redirectTo: `${origin}/auth/callback?next=/set-password` } : {}),
  });
  if (error) return { ok: false, message: error.message };

  const { error: profileError } = await admin
    .from('profiles')
    .update({ role: 'ministry_admin', ministry_id: ministryId, full_name: fullName || null })
    .eq('id', data.user.id);
  if (profileError) return { ok: false, message: profileError.message };

  revalidatePath('/super-admin');
  return { ok: true, message: `Invite sent to ${email}.` };
}
