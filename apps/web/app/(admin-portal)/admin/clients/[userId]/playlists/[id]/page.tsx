import { redirect } from "next/navigation";

interface AdminPlaylistDetailRedirectProps {
  params: { userId: string; id: string };
}

export default function AdminPlaylistDetailRedirect({ params }: AdminPlaylistDetailRedirectProps) {
  redirect(`/admin/clients/${params.userId}/screens`);
}
