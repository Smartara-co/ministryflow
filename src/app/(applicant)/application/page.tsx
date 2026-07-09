import { getSessionProfile } from '@/lib/auth';
import { APPLICANT_EDITABLE_STATUSES } from '@/lib/status';
import { StatusBadge } from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase/server';
import type {
  Application,
  Department,
  Ministry,
  PayScaleRow,
} from '@/lib/types';
import { ApplicationForm } from './ApplicationForm';

export const metadata = { title: 'My application — MinistryFlow' };

export default async function ApplicationPage() {
  const session = await getSessionProfile();
  const supabase = await createClient();
  if (!session || !supabase) return null;

  const [{ data: application }, { data: ministries }, { data: departments }, { data: payScale }] =
    await Promise.all([
      supabase
        .from('applications')
        .select('*')
        .eq('applicant_id', session.userId)
        .maybeSingle(),
      supabase.from('ministries').select('*').order('name'),
      supabase.from('departments').select('*').order('name'),
      supabase
        .from('pay_scale')
        .select('*')
        .order('grade')
        .order('grade_point'),
    ]);

  const app = application as Application | null;
  const editable = !app || APPLICANT_EDITABLE_STATUSES.includes(app.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Onboarding application
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Enter your details exactly as they appear on your appointment
            letter and posting notification.
          </p>
        </div>
        {app && <StatusBadge status={app.status} />}
      </div>

      {app?.status === 'needs_correction' && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-900">
            Corrections requested:
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-orange-900">
            {app.admin_comments}
          </p>
        </div>
      )}

      {!editable ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          Your application has been submitted and can no longer be edited. The
          Accounts Office will contact you if anything needs to change.
        </div>
      ) : (
        <ApplicationForm
          application={app}
          ministries={(ministries ?? []) as Ministry[]}
          departments={(departments ?? []) as Department[]}
          payScale={(payScale ?? []) as PayScaleRow[]}
        />
      )}
    </div>
  );
}
