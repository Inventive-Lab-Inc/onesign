import { redirect } from "next/navigation";

interface AdminClientPlaylistsPageProps {
  params: { userId: string };
}

export default function AdminClientPlaylistsPage({ params }: AdminClientPlaylistsPageProps) {
  redirect(`/admin/clients/${params.userId}/content`);
}
