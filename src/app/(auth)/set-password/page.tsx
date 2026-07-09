import { SetPasswordForm } from './SetPasswordForm';

export const metadata = { title: 'Set password — MinistryFlow' };

/** Landing page for invited admins (and password recovery): the invite link
 *  signs them in via /auth/callback?next=/set-password, then they choose a
 *  password here. */
export default function SetPasswordPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Set your password
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Choose a password to finish setting up your account.
      </p>
      <SetPasswordForm />
    </div>
  );
}
