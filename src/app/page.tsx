import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionProfile, homePathForRole } from '@/lib/auth';

export default async function HomePage() {
  const session = await getSessionProfile();
  if (session) redirect(homePathForRole(session.profile.role));

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">
          MinistryFlow
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Government staff onboarding, without the paperwork
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Submit your onboarding documents online, track your application, and
          get your salary set up faster. Republic of The Gambia.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/sign-up"
            className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            Start your onboarding
          </Link>
          <Link
            href="/sign-in"
            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
