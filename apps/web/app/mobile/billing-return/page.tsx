import Link from "next/link";

export default async function MobileBillingReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  const checkout = params.checkout ?? "";
  const title =
    checkout === "success"
      ? "Payment received"
      : checkout === "cancel"
        ? "Checkout canceled"
        : "Billing updated";
  const body =
    checkout === "success"
      ? "Return to the OneSign app — your plan will refresh automatically."
      : checkout === "cancel"
        ? "No charge was made. You can return to the OneSign app and try again."
        : "Return to the OneSign app to see your latest plan and usage.";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
      <p className="mt-8 text-sm text-muted-foreground">
        Or continue in the browser:{" "}
        <Link href="/account?tab=billing" className="font-medium text-brand underline-offset-2 hover:underline">
          Account billing
        </Link>
      </p>
    </main>
  );
}
