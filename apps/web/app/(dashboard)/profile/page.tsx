import { redirect } from "next/navigation";
import { AccountIdentityCard } from "@/components/account/account-identity-card";
import { AccountPreferences } from "@/components/account/account-preferences";
import "@/components/account/account.css";
import { getServerAuthWithProfile } from "@/lib/supabase/auth";

export default async function ProfilePage() {
  const { user, profile } = await getServerAuthWithProfile();
  if (!user) redirect("/login");

  const meta = user.user_metadata as Record<string, string | undefined> | undefined;
  const clientName =
    profile?.client_name?.trim() ||
    meta?.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "";

  return (
    <div className="space-y-8 py-1">
      <header className="account-page-header account-page-enter space-y-2 pb-3">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand-strong">Console</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My profile</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Manage your name, email, and personal preferences.
        </p>
      </header>

      <div className="space-y-8">
        <AccountIdentityCard name={clientName} email={user.email} />
        <AccountPreferences />
      </div>
    </div>
  );
}
