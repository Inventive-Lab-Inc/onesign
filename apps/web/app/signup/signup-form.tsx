"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSignupConfirmRedirectUrl } from "@/lib/auth/app-url";
import { Logo } from "@/components/logo";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { AuthHeroPanel } from "@/components/auth/auth-hero-panel";
import { AlertBanner } from "@/components/auth/alert-banner";

const inputClass =
  "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-[0.9375rem] text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-brand focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-faint20";

type SignupView = "form" | "check-email";

export function SignupForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [view, setView] = useState<SignupView>("form");
  const [email, setEmail] = useState(() => searchParams.get("email")?.trim() ?? "");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: getSignupConfirmRedirectUrl(),
          data: {
            full_name: companyName.trim() || undefined,
          },
        },
      });

      if (signUpError) {
        const message = signUpError.message.toLowerCase().includes("already registered")
          ? "An account already exists for this email. Try signing in instead."
          : signUpError.message;
        setError(message);
        toast.error(message);
        return;
      }

      setView("check-email");
      toast.success("Check your email to confirm your account");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-up failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen flex min-h-[100dvh] w-full bg-white">
      <AuthHeroPanel
        eyebrow="Free to start"
        headline={
          view === "form" ? (
            <>
              Start your
              <br />
              free trial.
            </>
          ) : (
            <>
              Almost
              <br />
              there.
            </>
          )
        }
        subline={
          view === "form"
            ? "No credit card required. Pair your first screen and publish in minutes."
            : "Confirm your email to open your OneSign console and start pairing screens."
        }
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

          <div key={view} className="login-step-in flex flex-col gap-5">
            {view === "form" ? (
              <>
                <div className="text-center lg:text-left">
                  <h1 className="text-[1.75rem] font-extrabold tracking-tight text-neutral-900">
                    Create your account
                  </h1>
                </div>

                <GoogleSignInButton
                  nextPath={next}
                  disabled={loading}
                  showDivider={false}
                  label="Sign up with Google"
                />

                <div className="flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-neutral-200" />
                  <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-wider text-neutral-400">
                    or email
                  </span>
                  <span className="h-px flex-1 bg-neutral-200" />
                </div>

                {error && <AlertBanner>{error}</AlertBanner>}

                <form onSubmit={onSubmit} className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-neutral-700">
                      Company name <span className="font-normal text-neutral-400">(optional)</span>
                    </span>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Your business"
                      autoComplete="organization"
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-neutral-700">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      autoComplete="email"
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-neutral-700">Password</span>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        required
                        minLength={8}
                        autoComplete="new-password"
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
                  </label>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-[0.9375rem] font-semibold text-brand-contrast transition-all hover:bg-brand-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? "Creating account…" : "Start free trial"}
                  </button>
                </form>

                <p className="text-center text-sm text-neutral-500">
                  Already have an account?{" "}
                  <Link href="/login" className="font-semibold text-brand hover:underline">
                    Sign in
                  </Link>
                </p>
              </>
            ) : (
              <>
                <div className="text-center lg:text-left">
                  <h1 className="text-[1.75rem] font-extrabold tracking-tight text-neutral-900">
                    Check your email
                  </h1>
                </div>
                <div
                  role="status"
                  className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-[0.8125rem] leading-relaxed text-emerald-800"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                  <span>
                    We sent a confirmation link to <strong>{email.trim()}</strong>. Click it to
                    activate your account and get started.
                  </span>
                </div>
                <p className="text-center text-sm text-neutral-500">
                  <Link href="/login" className="font-semibold text-brand hover:underline">
                    Back to sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
