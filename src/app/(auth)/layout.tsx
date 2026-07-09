export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">
          MinistryFlow
        </p>
        {children}
      </div>
    </main>
  );
}
