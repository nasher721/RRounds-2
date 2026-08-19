import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  classifyAuthError,
  getSafeAuthErrorMessage,
  type AuthProviderLabel,
} from "@/lib/auth/authErrorMessage";
import {
  validateLoginField,
  validateLoginForm,
  type LoginFieldErrors,
} from "@/lib/auth/loginValidation";
import { supabase } from "@/integrations/supabase/client";
import { recordAuthAttempt } from "@/lib/observability/authTelemetry";
import { APPROVED_OAUTH_PROVIDERS } from "@/config/authProviders";
import type { ApprovedOAuthProvider } from "@/config/authProviderPolicy";

const OAUTH_PROVIDER_LABELS: Record<ApprovedOAuthProvider, AuthProviderLabel> = {
  google: "Google",
  apple: "Apple",
};

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoadingProvider, setOAuthLoadingProvider] = useState<ApprovedOAuthProvider | null>(null);
  const [errors, setErrors] = useState<LoginFieldErrors>({});
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const validateForm = () => {
    const fieldErrors = validateLoginForm(email, password);
    setErrors(fieldErrors);
    return Object.keys(fieldErrors).length === 0;
  };

  const validateField = (field: "email" | "password", value: string) => {
    setErrors((prev) => ({
      ...prev,
      [field]: validateLoginField(field, value),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const startedAt = performance.now();

    if (!validateForm()) {
      recordAuthAttempt({
        method: "password",
        outcome: "invalid_input",
        durationMs: performance.now() - startedAt,
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        recordAuthAttempt({
          method: "password",
          outcome: classifyAuthError(error),
          durationMs: performance.now() - startedAt,
        });
        toast({
          title: "Login failed",
          description: getSafeAuthErrorMessage(error),
          variant: "destructive",
        });
      } else {
        recordAuthAttempt({
          method: "password",
          outcome: "success",
          durationMs: performance.now() - startedAt,
        });
        toast({
          title: "Welcome back",
          description: "You have successfully logged in.",
        });
        navigate("/");
      }
    } catch {
      recordAuthAttempt({
        method: "password",
        outcome: "unexpected_error",
        durationMs: performance.now() - startedAt,
      });
      toast({
        title: "Authentication error",
        description: "Something went wrong while processing your request.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: ApprovedOAuthProvider) => {
    const startedAt = performance.now();
    const label = OAUTH_PROVIDER_LABELS[provider];
    setOAuthLoadingProvider(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        recordAuthAttempt({
          method: provider,
          outcome: classifyAuthError(error),
          durationMs: performance.now() - startedAt,
        });
        toast({
          title: `${label} sign-in failed`,
          description: getSafeAuthErrorMessage(error, { providerLabel: label }),
          variant: "destructive",
        });
      } else {
        recordAuthAttempt({
          method: provider,
          outcome: "redirect_started",
          durationMs: performance.now() - startedAt,
        });
      }
    } catch {
      recordAuthAttempt({
        method: provider,
        outcome: "unexpected_error",
        durationMs: performance.now() - startedAt,
      });
      toast({
        title: `${label} sign-in failed`,
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setOAuthLoadingProvider(null);
    }
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-[100dvh] bg-[#f7f9fb] px-4 py-6 text-slate-950 sm:px-6 lg:px-8"
      aria-labelledby="auth-heading"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
        <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-950">
          <img src="/icons/icon-192.png" alt="" className="h-7 w-7 rounded-md" aria-hidden="true" />
          Rolling Rounds
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:py-24">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-slate-200/80 bg-white/70 px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Protected clinical workspace
            </div>
            <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight text-slate-950">
              Sign in, then get straight to the patient list.
            </h1>
            <p className="mt-5 max-w-lg text-[1.05rem] leading-7 text-slate-500">
              Rolling Rounds keeps authentication quiet and the workspace practical: notes, tasks, handoffs, and exports stay close.
            </p>
            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {["Team sync", "Field history", "Print export"].map((item) => (
                <div key={item} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_-15px_rgba(15,23,42,0.1)]">
          <div className="h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
          <div className="p-6 sm:p-8">
            <div className="mb-8">
              <h2 id="auth-heading" className="text-2xl font-semibold tracking-tight text-slate-950">
                Welcome back
              </h2>
              <p className="mt-2.5 text-sm leading-6 text-slate-500">
                Use your provisioned email and password to open the workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="doctor@hospital.org"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    // Re-validate while typing so a resolved error clears before
                    // the user reaches for the mouse; clearing on blur shifts the
                    // layout mid-click and can swallow the submit click.
                    if (errors.email) validateField("email", e.target.value);
                  }}
                  onBlur={(e) => e.target.value && validateField("email", e.target.value)}
                  disabled={loading}
                  startIcon={<Mail className="h-4 w-4" />}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  showSuccess={!errors.email && email.length > 0}
                  className={`h-[44px] ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {errors.email && (
                  <p id="email-error" className="text-xs text-destructive" role="alert">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </Label>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) validateField("password", e.target.value);
                  }}
                  onBlur={(e) => e.target.value && validateField("password", e.target.value)}
                  disabled={loading}
                  startIcon={<Lock className="h-4 w-4" />}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  showSuccess={!errors.password && password.length > 0}
                  endIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-slate-400 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  className={`h-[44px] pr-16 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {errors.password && (
                  <p id="password-error" className="text-xs text-destructive" role="alert">
                    {errors.password}
                  </p>
                )}
              </div>

              <Button type="submit" className="h-[44px] w-full rounded-xl font-semibold" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            {APPROVED_OAUTH_PROVIDERS.length > 0 ? (
              <>
                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">or</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>

                <div className="space-y-3">
                  {APPROVED_OAUTH_PROVIDERS.map((provider) => (
                    <Button
                      key={provider}
                      type="button"
                      variant="outline"
                      className="h-[44px] w-full rounded-xl border-slate-200 bg-white hover:bg-slate-50"
                      onClick={() => handleOAuthSignIn(provider)}
                      disabled={loading || oauthLoadingProvider !== null}
                    >
                      {oauthLoadingProvider === provider ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Continue with {OAUTH_PROVIDER_LABELS[provider]}
                    </Button>
                  ))}
                </div>
              </>
            ) : null}

            <p className="mt-6 text-center text-xs text-slate-600">
              Access is restricted to accounts provisioned by your administrator.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Auth;
