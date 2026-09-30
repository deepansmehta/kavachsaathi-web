import { redirect } from "next/navigation";

interface PageProps {
  params: { health_id: string };
}

/**
 * Legacy OTP activation route — superseded by adaptive QR at /card/[health_id].
 * Phone Auth / OTP is no longer used.
 */
export default function LegacyActivateByHealthIdRedirect({ params }: PageProps) {
  const id = decodeURIComponent(params.health_id || "").trim().toUpperCase();
  redirect(`/card/${encodeURIComponent(id)}`);
}
