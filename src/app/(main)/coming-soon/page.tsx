import { redirect } from "next/navigation";

/** Legacy URL — permanent redirect handled in middleware / netlify / next.config. */
export default function ComingSoonPage() {
  redirect("/");
}
