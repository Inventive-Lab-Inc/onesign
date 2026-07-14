import Link from "next/link";
import { OpenOnesignBillingDeepLink } from "./open-onesign-billing-deep-link";

/**
 * Fallback if Stripe still redirects to https (older sessions / non-deep-link clients).
 * Immediately hands back to the native app via onesign://billing.
 */
export default async function MobileBillingReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const params = await searchParams;
  const checkout = params.checkout ?? "success";
  const sessionId = params.session_id ?? "";
  const deepLink = new URL("onesign://billing");
  deepLink.searchParams.set("checkout", checkout);
  if (sessionId) deepLink.searchParams.set("session_id", sessionId);
  const href = deepLink.toString();

  const title =
    checkout === "success"
      ? "Payment received"
      : checkout === "cancel"
        ? "Checkout canceled"
        : "Billing updated";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">Opening the OneSign app…</p>
      <OpenOnesignBillingDeepLink href={href} />
      <p className="mt-4 text-sm text-muted-foreground">
        Or continue in the browser:{" "}
        <Link
          href="/account?tab=billing"
          className="font-medium text-brand underline-offset-2 hover:underline"
        >
          Account billing
        </Link>
      </p>
    </main>
  );
}
