"use client";

import { useEffect } from "react";

/** Hands control back to the native console via custom URL scheme. */
export function OpenOnesignBillingDeepLink({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <p className="mt-8 text-sm">
      <a href={href} className="font-medium text-brand underline-offset-2 hover:underline">
        Tap here if the app doesn’t open
      </a>
    </p>
  );
}
