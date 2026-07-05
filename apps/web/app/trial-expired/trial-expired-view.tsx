"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { billingContactMailto } from "@/lib/plan/billing";
import { isStripeCheckoutAvailable } from "@/lib/stripe/config";
import { cn } from "@/lib/utils";

export function TrialExpiredView() {
  const router = useRouter();
  const stripeEnabled = isStripeCheckoutAvailable();

  async function signOut() {
    try {
      const response = await fetch("/api/auth/signout", { method: "POST" });
      if (!response.ok) {
        toast.error("Sign out failed");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign out failed");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Your trial has ended</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your 14-day Solo trial is over. Upgrade to a paid plan to keep your screen live and continue managing
          content.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {stripeEnabled ? (
            <Link href="/account?tab=billing" className={cn(buttonVariants({ size: "default" }))}>
              Choose a plan
            </Link>
          ) : (
            <Link href={billingContactMailto("OneSign upgrade")} className={cn(buttonVariants({ size: "default" }))}>
              Contact us to upgrade
            </Link>
          )}
          <Button type="button" variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
