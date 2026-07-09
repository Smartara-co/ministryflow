import { notFound } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { generateSal1Pdf } from '@/lib/sal1';
import { createClient } from '@/lib/supabase/server';
import type { Application, ApplicationPayElement } from '@/lib/types';

/** Streams the SAL 1 PDF for an approved application. Admin-only (RLS
 *  already scopes reads; the explicit role check keeps applicants from
 *  fetching a half-configured form). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getSessionProfile();
  if (
    !session ||
    (session.profile.role !== 'ministry_admin' &&
      session.profile.role !== 'super_admin')
  ) {
    return new Response('Forbidden', { status: 403 });
  }

  const supabase = await createClient();
  if (!supabase) return new Response('Not configured', { status: 500 });

  const { data } = await supabase
    .from('applications')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  const application = data as Application | null;
  if (!application) notFound();

  if (application.status !== 'approved' && application.status !== 'sal1_generated') {
    return new Response('SAL 1 is only available for approved applications.', {
      status: 409,
    });
  }

  const [{ data: elements }, { data: ministry }] = await Promise.all([
    supabase
      .from('application_pay_elements')
      .select('*')
      .eq('application_id', id)
      .order('code'),
    supabase
      .from('ministries')
      .select('name')
      .eq('id', application.ministry_id)
      .maybeSingle(),
  ]);

  const pdf = await generateSal1Pdf(
    application,
    (elements ?? []) as ApplicationPayElement[],
    ministry?.name ?? 'Ministry',
  );

  const surname = application.surname ?? 'application';
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="SAL1_${surname}_${id.slice(0, 8)}.pdf"`,
    },
  });
}
