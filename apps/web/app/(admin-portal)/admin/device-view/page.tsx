import { redirect } from "next/navigation";
import { AdminDeviceView } from "@/components/admin/admin-device-view";
import { getServerStaffAuth } from "@/lib/auth/staff";

export default async function AdminDeviceViewPage() {
  const ctx = await getServerStaffAuth();
  if (!ctx) redirect("/login?next=/admin/device-view");

  return <AdminDeviceView />;
}
