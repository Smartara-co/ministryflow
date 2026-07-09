'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function SignUpForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError('The platform is not configured yet. Contact the administrator.');
      return;
    }

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setPending(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: String(form.get('email')),
      password,
      options: {
        data: { full_name: String(form.get('full_name')).trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setPending(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        Check your email for a confirmation link, then sign in.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-slate-700">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          autoComplete="name"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-emerald-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
