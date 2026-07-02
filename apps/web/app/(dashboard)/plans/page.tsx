import { redirect } from "next/navigation";

/** Legacy route — billing lives under Account settings. */
export default function PlansPage() {
  redirect("/account?tab=billing");
}
