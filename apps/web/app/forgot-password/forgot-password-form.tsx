"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AuthBrandHeader } from "@/components/auth-brand-header";
import { getPasswordResetRedirectUrl } from "@/lib/auth/app-url";
import { assets, getBackgroundStyle } from "@/lib/config/assets";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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
  },
  formTitle: {
    margin: "0 0 0.5rem",
    fontSize: "1.75rem",
    fontWeight: 800,
    color: "#111827",
    textAlign: "center",
  },
  formHint: {
    margin: "0 0 1rem",
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
    padding: "0.75rem",
    background: "#f0fdf4",
    color: "#166534",
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
  input: inputBase,
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
  },
};

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetRedirectUrl(),
      });

      if (resetError) {
        setError(resetError.message);
        toast.error(resetError.message);
        return;
      }

      setSent(true);
      toast.success("Password reset email sent.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message.includes("Missing Supabase")
            ? "App is not configured for sign-in. Contact your administrator."
            : err.message
          : "Could not send reset email";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card auth-card--login" style={styles.wrapper}>
      <div className="auth-left-panel" style={styles.leftPanel}>
        <h1 style={styles.leftTitle}>Forgot password?</h1>
        <p style={styles.leftSubtitle}>
          Enter your email and we&apos;ll send you a link to choose a new password.
        </p>
      </div>
      <div className="auth-right-panel" style={styles.rightPanel}>
        <div className="auth-content" style={styles.authContent}>
          <div className="auth-brand-offset" style={styles.brandMarkOffset}>
            <AuthBrandHeader variant="hero-light" />
          </div>
          <div style={styles.formStack}>
            <h2 style={styles.formTitle}>Reset password</h2>
            <p style={styles.formHint}>
              {sent
                ? "If an account exists for that address, a reset link is on its way."
                : "We'll email you a secure link to reset your password."}
            </p>
            {sent ? (
              <div style={styles.success} role="status">
                Check your inbox at <strong>{email}</strong>. The link expires after a short time.
              </div>
            ) : (
              <form onSubmit={onSubmit} style={styles.form}>
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
                <button type="submit" disabled={loading} style={styles.submitButton}>
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
            )}
            <p style={styles.footer}>
              Remember your password?{" "}
              <Link href="/login" style={styles.footerLink}>
                Back to login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
