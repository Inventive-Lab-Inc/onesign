"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppRouter } from "@/hooks/use-app-router";
import { useState } from "react";
import { ChevronLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { AuthHeroPanel } from "@/components/auth/auth-hero-panel";
import { AlertBanner } from "@/components/auth/alert-banner";

const inputClass =
  "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-[0.9375rem] text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-brand focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-faint20";

export function LoginForm() {
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const authError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  function resetToEmailStep() {
    setStep("email");
    setPassword("");
    setShowPassword(false);
    setError(null);
    setAccountNotFound(false);
  }

  async function onEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setError(null);
    setAccountNotFound(false);
    setLoading(true);
    try {
      const exists = await accountExists(trimmedEmail);
      if (exists === false) {
        setAccountNotFound(true);
        toast.error("Account not found.");
        return;
      }
      setEmail(trimmedEmail);
      setStep("password");
    } catch {
      setEmail(trimmedEmail);
      setStep("password");
    } finally {
      setLoading(false);
    }
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAccountNotFound(false);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        if (signInError.message === "Invalid login credentials") {
          const exists = await accountExists(email);
          if (exists === false) {
            setAccountNotFound(true);
            toast.error("Account not found.");
            return;
          }
          const message =
            "Email or password is incorrect. If you recently reset your password, use the new one.";
          setError(message);
          toast.error(message);
          return;
        }
        setError(signInError.message);
        toast.error(signInError.message);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message.includes("Missing Supabase")
            ? "App is not configured for sign-in. Contact your administrator."
            : err.message
          : "Sign-in failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function accountExists(candidateEmail: string): Promise<boolean | null> {
    try {
      const res = await fetch("/api/auth/account-exists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: candidateEmail }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { exists?: boolean | null };
      return data.exists ?? null;
    } catch {
      return null;
    }
  }

  const authErrors = (
    <>
      {authError === "auth_confirm_failed" && (
        <AlertBanner>
          That link is invalid or has expired. Request a new confirmation or password reset email.
        </AlertBanner>
      )}
      {authError === "google_auth_failed" && (
        <AlertBanner>Google sign-in was cancelled or failed. Please try again.</AlertBanner>
      )}
      {authError === "google_bridge_failed" && (
        <AlertBanner>
          Google sign-in succeeded but your console session could not be started. Check server
          configuration or try again.
        </AlertBanner>
      )}
      {authError === "Configuration" && (
        <AlertBanner>
          Google sign-in is not configured yet. Set AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, and
          AUTH_SECRET.
        </AlertBanner>
      )}
      {accountNotFound && (
        <AlertBanner>
          Account not found. If you are new here,{" "}
          <Link
            href={email.trim() ? `/signup?email=${encodeURIComponent(email.trim())}` : "/signup"}
            className="font-semibold text-brand underline-offset-2 hover:underline"
          >
            sign up
          </Link>{" "}
          now.
        </AlertBanner>
      )}
      {error && <AlertBanner>{error}</AlertBanner>}
    </>
  );

  return (
    <div className="login-screen flex min-h-[100dvh] w-full bg-white">
      <AuthHeroPanel
        eyebrow="Digital signage, simplified"
        headline={
          <>
            One console.
            <br />
            Every screen.
          </>
        }
        subline="Pair a TV in seconds. Push playlists, schedules, and live updates to every display at once — no IT visit required."
      />

      <div
        className="flex w-full flex-1 flex-col items-center justify-center px-6 py-10 sm:px-10 lg:px-14 xl:px-20"
        style={{
          paddingTop: "max(2.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex w-full max-w-[23rem] flex-col">
          <div className="mb-10 flex justify-center lg:mb-12 lg:justify-start">
            <Logo height={32} tone="dark" />
          </div>

          <div key={step} className="login-step-in flex flex-col gap-5">
            {step === "email" ? (
              <>
                <div className="text-center lg:text-left">
                  <h1 className="text-[1.75rem] font-extrabold tracking-tight text-neutral-900">
                    Welcome back
                  </h1>
                  <p className="mt-1.5 text-[0.9375rem] text-neutral-500">
                    Sign in to your OneSign console
                  </p>
                </div>

                <GoogleSignInButton nextPath={next} disabled={loading} showDivider={false} />

                <div className="flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-neutral-200" />
                  <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-wider text-neutral-400">
                    or email
                  </span>
                  <span className="h-px flex-1 bg-neutral-200" />
                </div>

                {authErrors}

                <form onSubmit={onEmailContinue} className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-neutral-700">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      autoComplete="email"
                      autoFocus
                      className={inputClass}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={loading}
                    data-auth-anchor
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-[0.9375rem] font-semibold text-brand-contrast transition-all hover:bg-brand-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? "Checking…" : "Continue"}
                  </button>
                </form>
              </>
            ) : (
              <form onSubmit={onPasswordSubmit} className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={resetToEmailStep}
                  className="flex items-center gap-1 self-start text-[0.8125rem] font-medium text-neutral-500 transition-colors hover:text-neutral-800"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Back
                </button>

                <div className="text-center lg:text-left">
                  <h1 className="text-[1.75rem] font-extrabold tracking-tight text-neutral-900">
                    Enter your password
                  </h1>
                </div>

                {authErrors}

                <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                    {email.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">{email}</span>
                  <button
                    type="button"
                    onClick={resetToEmailStep}
                    className="shrink-0 text-[0.8125rem] font-semibold text-brand hover:underline"
                  >
                    Change
                  </button>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-neutral-700">Password</span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                      autoFocus
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-neutral-400 transition-colors hover:text-neutral-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
                      ) : (
                        <Eye className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                  <Link
                    href={`/forgot-password?email=${encodeURIComponent(email)}`}
                    className="self-end text-[0.8125rem] font-medium text-brand hover:underline"
                  >
                    Forgot password?
                  </Link>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  data-auth-anchor
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-[0.9375rem] font-semibold text-brand-contrast transition-all hover:bg-brand-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            )}
          </div>

          <p className="mt-9 text-center text-sm text-neutral-500">
            New to OneSign?{" "}
            <Link href="/signup" className="font-semibold text-brand hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
