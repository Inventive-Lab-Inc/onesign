import { redirect } from "next/navigation";

export default function MediaPage() {
  redirect("/playlists?view=library");
}
