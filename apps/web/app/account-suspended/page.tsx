import { redirect } from "next/navigation";
import { AccountSuspendedView } from "@/app/account-suspended/account-suspended-view";
import { fetchProfileIsDisabled } from "@/lib/supabase/profile";
import { getServerAuthWithProfile } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AccountSuspendedPage() {
  const { supabase, user } = await getServerAuthWithProfile();

  if (!user) {
    redirect("/login");
  }

  const isDisabled = await fetchProfileIsDisabled(supabase, user.id);

  // Only leave this page when we know the account is active — avoid redirect loops
  // when optional profile columns fail to load in other routes.
  if (isDisabled === false) {
    redirect("/dashboard");
  }

  return <AccountSuspendedView />;
}
