import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, ArrowRight, CheckCircle2, ClipboardList, FileText, LockKeyhole, Mail, Mic, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  CONTACT_EMAIL,
  CONTACT_EMAIL_IS_CONFIGURED,
  SHOW_CONTACT_CONFIGURATION_HINT,
} from "@/config/marketing";
import { PRIVACY_NOTICE_URL } from "@/config/legal";
import { recordMarketingEvent } from "@/lib/observability/marketingTelemetry";

interface FeatureHighlightsProps {
  prefersReducedMotion: boolean;
}

const stats = [
  { value: "10", label: "body systems", detail: "Structured review without hunting through tabs" },
  { value: "1", label: "shared list", detail: "Patient notes, tasks, and handoff context together" },
  { value: "3", label: "responsive layouts", detail: "Designed for phone, tablet, and desktop screens" },
];

const features = [
  {
    icon: ClipboardList,
    title: "Rounds-first patient list",
    description: "Keep the active census, room, identifiers, and daily notes close together for faster pre-rounding.",
  },
  {
    icon: Users,
    title: "Team collaboration",
    description: "Shared lists, field history, and task visibility help reduce duplicate work across the team.",
  },
  {
    icon: Activity,
    title: "Clinical structure",
    description: "Systems review, medications, labs, imaging, and interval events stay readable at bedside pace.",
  },
  {
    icon: FileText,
    title: "Print and export",
    description: "Generate handoff-ready layouts when a paper signout or exported report is still the right tool.",
  },
  {
    icon: Mic,
    title: "Dictation support",
    description: "Capture notes with voice workflows where enabled, then refine them before saving.",
  },
  {
    icon: RefreshCw,
    title: "Offline-aware sync",
    description: "Workflows are designed to recover gracefully when hospital networks are imperfect.",
  },
];

const safeguards = [
  "Access requires authentication; authorization depends on deployment roles and policies",
  "HTTPS encrypts transport when deployed with a valid TLS endpoint",
  "Some field changes retain history; this is not a comprehensive access audit log",
  "Browser caching may store clinical content locally; use managed devices and sign out on shared devices",
];

const FeatureHighlights: React.FC<FeatureHighlightsProps> = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const goApp = () => {
    recordMarketingEvent("footerWorkspace");
    if (user) {
      navigate("/", { replace: true });
      window.location.reload();
      return;
    }
    navigate("/auth");
  };

  return (
    <>
      <section id="features" className="scroll-mt-20 border-b border-slate-200/80 bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-3xl font-semibold tracking-tight text-slate-950">{stat.value}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{stat.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{stat.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold text-sky-700">Functional by default</p>
              <h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Everything important stays one click away.
              </h2>
              <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
                The interface favors fast scanning, clear labels, and practical controls over decorative panels.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-950">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="security" className="scroll-mt-20 border-b border-slate-200/80 bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="max-w-lg text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Security language your review team can read.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Security and HIPAA readiness depend on the deployment configuration, provider agreements or BAAs, administrative controls, device protections, and actual use. The product does not itself establish compliance.
            </p>
            <Link
              to="/security"
              onClick={() => recordMarketingEvent("securityGuidance")}
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Review deployment guidance
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-primary" aria-hidden="true" />
              <h3 className="text-base font-semibold text-slate-950">Baseline safeguards</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {safeguards.map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-20 border-b border-slate-200/80 bg-white px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-xl border border-slate-200 bg-slate-50 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Pilot and enterprise pricing</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Use the same product for small team pilots or organization-wide rollout. We can match security review, training, and procurement needs.
            </p>
          </div>
          {CONTACT_EMAIL_IS_CONFIGURED && (
            <a
              href="#contact"
              onClick={() => recordMarketingEvent("pricingContact")}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Talk to us
              <Mail className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </section>

      <section id="contact" className="scroll-mt-20 bg-white px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-semibold text-sky-700">Contact</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Questions about fit or rollout?</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              {CONTACT_EMAIL_IS_CONFIGURED
                ? "Reach out for pilots, training, security reviews, or clinical workflow questions."
                : "Public contact details are not available during this prelaunch deployment."}
            </p>
          </div>
          {CONTACT_EMAIL_IS_CONFIGURED && (
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              onClick={() => recordMarketingEvent("contactEmail")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {CONTACT_EMAIL}
            </a>
          )}
          {SHOW_CONTACT_CONFIGURATION_HINT && (
            <p className="text-sm text-slate-500 lg:col-span-2">
              Set <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">VITE_CONTACT_EMAIL</code> in production.
            </p>
          )}
        </div>
      </section>

      <section className="bg-slate-950 px-4 py-14 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-white/70">Rolling Rounds</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Open the workspace when rounds start.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              Access is provisioned by the deployment administrator. Authorized users can sign in and return to the patient list.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={goApp}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {user ? "Open dashboard" : "Sign in"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Rolling Rounds. All rights reserved.
          </p>
          <div className="flex gap-4">
            <a
              href={PRIVACY_NOTICE_URL || "/privacy"}
              className="font-medium text-slate-700 hover:text-slate-950 hover:underline"
            >
              Privacy
            </a>
            <Link to="/security" className="font-medium text-slate-700 hover:text-slate-950 hover:underline">
              Security
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
};

export default FeatureHighlights;
