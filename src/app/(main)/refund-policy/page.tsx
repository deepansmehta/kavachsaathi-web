import { redirect } from "next/navigation";

/** Legacy URL — Merchant Center / footer use /returns. */
export default function RefundPolicyRedirect() {
  redirect("/returns");
}
