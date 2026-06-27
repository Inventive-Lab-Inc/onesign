import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import { getServerAuth } from "@/lib/supabase/auth";

export default async function HomePage() {
  const { user } = await getServerAuth();

  if (user) redirect("/dashboard");

  return <LandingPage />;
}
