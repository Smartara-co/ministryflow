import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionProfile, homePathForRole } from '@/lib/auth';
import { SignUpForm } from './SignUpForm';

export const metadata = { title: 'Create account — MinistryFlow' };

export default async function SignUpPage() {
  const session = await getSessionProfile();
  if (session) redirect(homePathForRole(session.profile.role));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        For newly appointed government staff submitting onboarding documents.
      </p>
      <SignUpForm />
      <p className="mt-6 text-sm text-slate-600">
        Already registered?{' '}
        <Link href="/sign-in" className="font-medium text-emerald-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
