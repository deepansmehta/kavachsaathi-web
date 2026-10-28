import { redirect } from "next/navigation";

/** Legacy URL — Merchant Center / footer use /shipping. */
export default function ShippingPolicyRedirect() {
  redirect("/shipping");
}
