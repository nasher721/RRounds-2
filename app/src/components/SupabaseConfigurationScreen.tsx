import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";

export function SupabaseConfigurationScreen() {
  return (
    <main
      id="main-content"
      className="flex min-h-[100dvh] items-center justify-center bg-[#f7f9fb] px-6 py-12 text-slate-950"
      aria-labelledby="configuration-heading"
    >
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.12)] sm:p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 id="configuration-heading" className="mt-6 text-2xl font-semibold tracking-tight">
          Rolling Rounds needs a connection setup
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          This desktop build is healthy, but it was started without the public Supabase
          connection settings required for sign-in and the clinical workspace.
        </p>
        <div className="mt-6 rounded-xl bg-slate-950 p-5 font-mono text-sm leading-7 text-slate-100">
          <p>VITE_SUPABASE_URL=https://&lt;project&gt;.supabase.co</p>
          <p>VITE_SUPABASE_PUBLISHABLE_KEY=&lt;publishable-key&gt;</p>
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-600">
          Add those values to <code className="rounded bg-slate-100 px-1.5 py-0.5">app/.env.local</code>,
          then restart the desktop command or rebuild the DMG. Never use a service-role key here.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Check again
          </button>
          <a
            href="https://supabase.com/docs/guides/getting-started"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Supabase setup
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>
    </main>
  );
}

