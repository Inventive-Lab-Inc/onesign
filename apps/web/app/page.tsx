import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import { getServerAuth } from "@/lib/supabase/auth";
import { appUrl, isMarketingHost } from "@/lib/site-hosts";

export default async function HomePage() {
  const host = headers().get("host");
  const { user } = await getServerAuth();

  if (isMarketingHost(host)) {
    if (user) redirect(appUrl("/dashboard"));
    return <LandingPage />;
  }

  redirect(user ? "/dashboard" : "/login");
}
