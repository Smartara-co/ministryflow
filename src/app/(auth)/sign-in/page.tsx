import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionProfile, homePathForRole } from '@/lib/auth';
import { SignInForm } from './SignInForm';

export const metadata = { title: 'Sign in — MinistryFlow' };

export default async function SignInPage() {
  const session = await getSessionProfile();
  if (session) redirect(homePathForRole(session.profile.role));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Government staff onboarding — Republic of The Gambia
      </p>
      <SignInForm />
      <p className="mt-6 text-sm text-slate-600">
        New staff member?{' '}
        <Link href="/sign-up" className="font-medium text-emerald-700 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
