'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">
              MinistryFlow
            </p>
            <h1 className="mt-4 text-3xl font-semibold text-slate-900">
              Something went wrong
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              A runtime error interrupted this page. Please refresh and try again.
            </p>
            <button
              className="mt-6 rounded-full bg-emerald-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-800"
              onClick={() => reset()}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
