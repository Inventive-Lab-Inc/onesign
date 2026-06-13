"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppRouter } from "@/hooks/use-app-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { assets, getBackgroundStyle } from "@/lib/config/assets";
import { AuthBrandHeader } from "@/components/auth-brand-header";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

const AUTH_PANEL_CSS = `.auth-card input::placeholder { color: #9ca3af; }
.auth-right-panel { overflow: auto; scrollbar-width: none; -ms-overflow-style: none; }
.auth-right-panel::-webkit-scrollbar { display: none; }`;

const inputBase: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.75rem",
  background: "#f9fafb",
  border: "0.0625rem solid #e5e7eb",
  borderRadius: "0.5rem",
  fontSize: "0.875rem",
  color: "#111827",
  boxSizing: "border-box",
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "fixed",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    overflow: "hidden",
    background: "#e5e7eb",
    padding: "0.5rem",
    boxSizing: "border-box",
    borderRadius: "0.75rem",
  },
  leftPanel: {
    flex: 7,
    minWidth: 0,
    padding: "2.5rem 2rem",
    ...getBackgroundStyle(assets.loginBackgroundValue),
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "0.5rem",
    minHeight: 0,
    overflow: "hidden",
    borderRadius: "0.5rem",
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  leftTitle: {
    margin: 0,
    fontSize: "clamp(2rem, 4vw, 3.5rem)",
    fontWeight: 700,
    color: "#fff",
    lineHeight: 1.1,
  },
  leftSubtitle: {
    margin: 0,
    fontSize: "1.05rem",
    fontWeight: 400,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 1.25,
  },
  rightPanel: {
    flex: 3,
    minWidth: 0,
    minHeight: 0,
    padding: "2.5rem 2rem",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    overflow: "auto",
    borderRadius: "0.5rem",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  authContent: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2.5rem",
  },
  brandMarkOffset: {
    transform: "translateY(-3rem)",
  },
  formStack: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  formTitle: {
    margin: "0 0 1rem",
    fontSize: "1.75rem",
    fontWeight: 800,
    color: "#111827",
    textAlign: "center",
  },
  formHint: {
    margin: "-0.5rem 0 1rem",
    fontSize: "0.8125rem",
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 1.4,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  error: {
    padding: "0.5rem 0.75rem",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: "0.5rem",
    fontSize: "0.8125rem",
  },
  success: {
    padding: "0.75rem 0.875rem",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: "0.5rem",
    fontSize: "0.8125rem",
    lineHeight: 1.45,
    textAlign: "center",
  },
  info: {
    padding: "0.5rem 0.75rem",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: "0.5rem",
    fontSize: "0.8125rem",
    lineHeight: 1.45,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
  },
  fieldLabel: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
  },
  fieldOptional: {
    fontWeight: 400,
    color: "#9ca3af",
  },
  forgotLink: {
    alignSelf: "flex-end",
    marginTop: "0.125rem",
    fontSize: "0.8125rem",
    color: "#171717",
    fontWeight: 600,
    textDecoration: "underline",
    whiteSpace: "nowrap",
  },
  input: inputBase,
  inputPassword: { ...inputBase, paddingRight: "2.5rem" },
  textarea: {
    ...inputBase,
    minHeight: "5rem",
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  passwordWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  eyeButton: {
    position: "absolute",
    right: "0.5rem",
    top: "50%",
    transform: "translateY(-50%)",
    padding: "0.25rem",
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    marginTop: "0.5rem",
    padding: "0.75rem 1rem",
    background: "#171717",
    color: "#fff",
    border: "none",
    borderRadius: "0.5rem",
    fontSize: "0.9375rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  footer: {
    margin: "1.5rem 0 0",
    fontSize: "0.8125rem",
    color: "#6b7280",
    textAlign: "center",
  },
  footerLink: {
    color: "#171717",
    fontWeight: 700,
    textDecoration: "underline",
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontSize: "inherit",
    fontFamily: "inherit",
  },
};

type AuthView = "login" | "apply" | "apply-success";

export function LoginForm() {
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const authError = searchParams.get("error");
  const notice = searchParams.get("notice");
  const shouldOpenApply =
    searchParams.get("apply") === "1" || authError === "google_not_invited";
  const prefilledApplyEmail = searchParams.get("email")?.trim() ?? "";

  const [view, setView] = useState<AuthView>(shouldOpenApply ? "apply" : "login");
  const [applyFromGoogle, setApplyFromGoogle] = useState(shouldOpenApply);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [applyEmail, setApplyEmail] = useState(prefilledApplyEmail);
  const [companyName, setCompanyName] = useState("");
  const [screenCount, setScreenCount] = useState("");
  const [applyMessage, setApplyMessage] = useState("");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applySuccessMessage, setApplySuccessMessage] = useState<string | null>(null);

  function switchToApply() {
    setView("apply");
    setApplyError(null);
    setError(null);
  }

  function switchToLogin() {
    setView("login");
    setApplyFromGoogle(false);
    setApplyError(null);
    setError(null);
  }

  useEffect(() => {
    if (!shouldOpenApply) return;

    const params = new URLSearchParams();
    if (next !== "/dashboard") params.set("next", next);
    const qs = params.toString();
    const url = qs ? `/login?${qs}` : "/login";
    window.history.replaceState(window.history.state, "", url);
  }, [shouldOpenApply, next]);

  async function onLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        const message =
          signInError.message === "Invalid login credentials"
            ? "Email or password is incorrect. If you recently reset your password, use the new one."
            : signInError.message;
        setError(message);
        toast.error(message);
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

  async function onApplySubmit(e: React.FormEvent) {
    e.preventDefault();
    setApplyError(null);
    setApplyLoading(true);

    try {
      const parsedScreens = screenCount.trim() ? Number.parseInt(screenCount, 10) : undefined;
      const response = await fetch("/api/waitlist/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: applyEmail.trim(),
          companyName: companyName.trim() || undefined,
          screenCount:
            parsedScreens && Number.isFinite(parsedScreens) && parsedScreens >= 1
              ? parsedScreens
              : undefined,
          message: applyMessage.trim() || undefined,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not submit your application");
      }

      setApplySuccessMessage(
        body?.message ?? "Thanks for applying. The OneSign team will get back to you soon.",
      );
      setView("apply-success");
      toast.success("Application submitted");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not submit your application";
      setApplyError(message);
      toast.error(message);
    } finally {
      setApplyLoading(false);
    }
  }

  const leftCopy =
    view === "login"
      ? {
          title: "Welcome back",
          subtitle: "Sign in with Google or the email and password from your invitation.",
        }
      : {
          title: "Get started",
          subtitle: "Join the waitlist and the OneSign team will reach out when you're approved.",
        };

  return (
    <div className="auth-card auth-card--login" style={styles.wrapper}>
      <style>{AUTH_PANEL_CSS}</style>
      <div className="auth-left-panel" style={styles.leftPanel}>
        <h1 style={styles.leftTitle}>{leftCopy.title}</h1>
        <p style={styles.leftSubtitle}>{leftCopy.subtitle}</p>
      </div>
      <div className="auth-right-panel" style={styles.rightPanel}>
        <div className="auth-content" style={styles.authContent}>
          <div className="auth-brand-offset" style={styles.brandMarkOffset}>
            <AuthBrandHeader variant="hero-light" />
          </div>
          <div style={styles.formStack}>
            {view === "login" ? (
              <>
                <h2 style={styles.formTitle}>Login</h2>
                <GoogleSignInButton nextPath={next} disabled={loading} />
                <form onSubmit={onLoginSubmit} style={styles.form}>
                  {notice === "invite_only" && (
                    <div
                      style={{
                        ...styles.error,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                      }}
                      role="status"
                    >
                      Accounts are invitation-only. Contact your administrator if you need access.
                    </div>
                  )}
                  {authError === "auth_confirm_failed" && (
                    <div style={styles.error} role="alert">
                      That link is invalid or has expired. Ask your administrator to resend your invitation.
                    </div>
                  )}
                  {authError === "google_auth_failed" && (
                    <div style={styles.error} role="alert">
                      Google sign-in was cancelled or failed. Please try again.
                    </div>
                  )}
                  {authError === "google_bridge_failed" && (
                    <div style={styles.error} role="alert">
                      Google sign-in succeeded but your console session could not be started. Check server
                      configuration or contact your administrator.
                    </div>
                  )}
                  {authError === "Configuration" && (
                    <div style={styles.error} role="alert">
                      Google sign-in is not configured yet. Set AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, and
                      AUTH_SECRET.
                    </div>
                  )}
                  {error && (
                    <div style={styles.error} role="alert">
                      {error}
                    </div>
                  )}
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      autoComplete="email"
                      style={styles.input}
                    />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Password</span>
                    <div style={styles.passwordWrap}>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        autoComplete="current-password"
                        style={styles.inputPassword}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        style={styles.eyeButton}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff size={18} color="#6b7280" strokeWidth={1.75} />
                        ) : (
                          <Eye size={18} color="#6b7280" strokeWidth={1.75} />
                        )}
                      </button>
                    </div>
                    <Link
                      href={
                        email.trim()
                          ? `/forgot-password?email=${encodeURIComponent(email.trim())}`
                          : "/forgot-password"
                      }
                      style={styles.forgotLink}
                    >
                      Forgot password?
                    </Link>
                  </label>
                  <button type="submit" disabled={loading} style={styles.submitButton}>
                    {loading ? "Signing in…" : "Login"}
                  </button>
                </form>
                <p style={styles.footer}>
                  Don&apos;t have an account?{" "}
                  <button type="button" style={styles.footerLink} onClick={switchToApply}>
                    Apply Now
                  </button>
                </p>
              </>
            ) : view === "apply" ? (
              <>
                <h2 style={styles.formTitle}>Apply for access</h2>
                <p style={styles.formHint}>
                  Tell us a bit about your business. We&apos;ll review and get back to you.
                </p>
                <form onSubmit={onApplySubmit} style={styles.form}>
                  {applyFromGoogle && (
                    <div style={styles.info} role="status">
                      We don&apos;t have an account for this Google email yet. Submit your details below
                      and the OneSign team will get back to you.
                    </div>
                  )}
                  {applyError && (
                    <div style={styles.error} role="alert">
                      {applyError}
                    </div>
                  )}
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Email</span>
                    <input
                      type="email"
                      value={applyEmail}
                      onChange={(e) => setApplyEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      autoComplete="email"
                      style={styles.input}
                    />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>
                      Company name <span style={styles.fieldOptional}>(optional)</span>
                    </span>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Your business"
                      style={styles.input}
                    />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>
                      Number of screens <span style={styles.fieldOptional}>(optional)</span>
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={screenCount}
                      onChange={(e) => setScreenCount(e.target.value)}
                      placeholder="e.g. 3"
                      style={styles.input}
                    />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>
                      Message <span style={styles.fieldOptional}>(optional)</span>
                    </span>
                    <textarea
                      value={applyMessage}
                      onChange={(e) => setApplyMessage(e.target.value)}
                      placeholder="What are you looking to display?"
                      style={styles.textarea}
                    />
                  </label>
                  <button type="submit" disabled={applyLoading} style={styles.submitButton}>
                    {applyLoading ? "Submitting…" : "Submit application"}
                  </button>
                </form>
                <p style={styles.footer}>
                  Already have access?{" "}
                  <button type="button" style={styles.footerLink} onClick={switchToLogin}>
                    Back to login
                  </button>
                </p>
              </>
            ) : (
              <>
                <h2 style={styles.formTitle}>Application received</h2>
                <div style={styles.success} role="status">
                  {applySuccessMessage}
                </div>
                <p style={styles.footer}>
                  <button type="button" style={styles.footerLink} onClick={switchToLogin}>
                    Back to login
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
