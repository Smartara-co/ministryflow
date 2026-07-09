import Link from 'next/link';

interface NavLink {
  href: string;
  label: string;
}

export function AppShell({
  navLinks,
  areaLabel,
  userName,
  children,
}: {
  navLinks: NavLink[];
  areaLabel: string;
  userName: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">
              MinistryFlow
            </p>
            <p className="text-xs text-slate-500">{areaLabel}</p>
          </div>
          <nav className="flex flex-1 flex-wrap items-center gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-700 hover:text-emerald-700"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            {userName && (
              <span className="hidden text-sm text-slate-600 sm:inline">{userName}</span>
            )}
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:border-emerald-700 hover:text-emerald-700"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
