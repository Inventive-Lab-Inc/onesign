import { redirect } from "next/navigation";

interface AdminClientMediaPageProps {
  params: { userId: string };
}

export default function AdminClientMediaPage({ params }: AdminClientMediaPageProps) {
  redirect(`/admin/clients/${params.userId}/playlists?view=library`);
}
