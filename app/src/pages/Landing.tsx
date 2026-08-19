import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, ClipboardList, LockKeyhole, RefreshCw, ShieldCheck, Smartphone, Users, type LucideIcon } from "lucide-react";
import FeatureHighlights from "@/components/landing/FeatureHighlights";
import { useMotionPreference } from "@/hooks/useReducedMotion";
import { recordMarketingEvent } from "@/lib/observability/marketingTelemetry";

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { prefersReducedMotion } = useMotionPreference();

  React.useEffect(() => {
    recordMarketingEvent("landingView");
  }, []);

  const handleSignIn = () => {
    navigate("/auth");
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  };

  const trustPoints: Array<[string, LucideIcon]> = [
    ["Mobile ready", Smartphone],
    ["Team sync", RefreshCw],
    ["Access controls", LockKeyhole],
  ];

  return (
    <div className="landing-page min-h-[100dvh] bg-[#f7f9fb] text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-[90] border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a
            href="#top"
            className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
            }}
          >
            <img src="/icons/favicon-64.png" alt="" className="h-7 w-7 rounded-md" aria-hidden="true" />
            <span className="truncate text-sm font-semibold tracking-tight text-slate-950">Rolling Rounds</span>
          </a>

          <nav className="hidden items-center gap-1 text-sm font-medium text-slate-500 md:flex" aria-label="Primary">
            {[
              ["Features", "features"],
              ["Security", "security"],
              ["Pricing", "pricing"],
              ["Contact", "contact"],
            ].map(([label, id]) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                className="rounded-lg px-3 py-2 transition-colors hover:bg-slate-100/80 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => {
              recordMarketingEvent("headerSignIn");
              handleSignIn();
            }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Sign in
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {/* Hero */}
        <section id="top" className="relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.5) 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-28">
            <div className="max-w-2xl">
              <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-slate-200/80 bg-white/70 px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Built for clinical rounding teams
              </div>
              <h1 className="max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.5rem]">
                A cleaner command center for rounds.
              </h1>
              <p className="mt-6 max-w-xl text-[1.05rem] leading-7 text-slate-500">
                Manage patient lists, notes, tasks, and team handoffs in one focused workspace.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    recordMarketingEvent("heroSignIn");
                    handleSignIn();
                  }}
                  className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Sign in to workspace
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    recordMarketingEvent("featureExplore");
                    scrollToSection("features");
                  }}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Explore features
                </button>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
                {trustPoints.map(([label, Icon]) => (
                  <div key={label} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary/70" aria-hidden="true" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_-15px_rgba(15,23,42,0.1)]">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <ClipboardList className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Today's list</p>
                      <p className="text-xs text-slate-400">4 active patients</p>
                    </div>
                  </div>
                  <div className="rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
                    Synced
                  </div>
                </div>
                <div className="grid gap-0 lg:grid-cols-[240px_1fr]">
                  <div className="border-b border-slate-100 p-3 lg:border-b-0 lg:border-r lg:border-slate-100">
                    {[
                      ["A. Chen", "7W-12", "2 tasks"],
                      ["M. Patel", "7W-14", "Ready"],
                      ["J. Rivera", "ICU-03", "Review labs"],
                    ].map(([name, bed, status], index) => (
                      <div
                        key={name}
                        className={`mb-1.5 rounded-xl border p-3 text-sm ${
                          index === 0
                            ? "border-primary/20 bg-primary/[0.04]"
                            : "border-transparent hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{name}</span>
                          <span className="font-mono text-[11px] text-slate-400">{bed}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{status}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4 p-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Interval events</p>
                      <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 text-sm leading-6 text-slate-600">
                        Overnight oxygen weaned. Net negative 800 mL. Family updated after rounds.
                      </div>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {[
                        ["Systems", "Focused ICU-style review"],
                        ["Tasks", "Follow-ups linked to patient"],
                        ["Export", "Print handoff-ready notes"],
                        ["AI tools", "Drafting support with guardrails"],
                      ].map(([title, body]) => (
                        <div key={title} className="rounded-xl border border-slate-100 bg-white p-3.5">
                          <p className="text-sm font-semibold text-slate-900">{title}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{body}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/60 px-2.5 py-1">
                        <Users className="h-3 w-3" aria-hidden="true" />
                        Team view
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/60 px-2.5 py-1">
                        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                        Audit-aware
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <FeatureHighlights prefersReducedMotion={prefersReducedMotion} />
      </main>
    </div>
  );
};

export default Landing;
