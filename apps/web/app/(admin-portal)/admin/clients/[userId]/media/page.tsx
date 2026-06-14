import { redirect } from "next/navigation";

interface AdminClientMediaRedirectProps {
  params: { userId: string };
}

export default function AdminClientMediaRedirect({ params }: AdminClientMediaRedirectProps) {
  redirect(`/admin/clients/${params.userId}/content`);
}
