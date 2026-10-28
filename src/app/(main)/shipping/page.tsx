import Link from "next/link";
import { COMPANY } from "@/lib/pricing";
import { PolicyPageShell } from "@/components/layout/PolicyPageShell";

export const metadata = {
  title: "Shipping & Delivery Policy",
  description:
    "KavachSaathi free shipping across India — dispatch in 1–2 days, delivery in 4–7 business days.",
  robots: { index: true, follow: true },
};

export default function ShippingPage() {
  return (
    <PolicyPageShell
      title="Shipping & Delivery Policy"
      updated="28 October 2026"
      hindiSummary="भारत में सभी ऑर्डर की डिलीवरी मुफ़्त। 1–2 कार्य दिवस में डिस्पैच; आमतौर पर 4–7 कार्य दिवस में डिलीवरी।"
    >
      <p>
        This policy applies to KavachSaathi Smart QR Emergency Health Cards sold
        by <strong>{COMPANY.legalName}</strong> on{" "}
        <a className="text-[#D4AF37] underline" href={COMPANY.siteUrl}>
          kavachsaathi.in
        </a>
        .
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Free delivery across India
      </h2>
      <p>
        All orders ship <strong>FREE</strong> across India. There is no delivery
        or shipping charge added at checkout.
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Dispatch &amp; delivery timelines
      </h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Orders are typically <strong>dispatched within 1–2 business days</strong>{" "}
          after successful payment confirmation.
        </li>
        <li>
          Delivered in <strong>4–7 business days</strong> via courier / India
          Post (from dispatch).
        </li>
        <li>
          Remote or rural PIN codes may take slightly longer.
        </li>
      </ul>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Tracking
      </h2>
      <p>
        Tracking details are shared on the customer&apos;s email and/or phone
        after dispatch.
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Address accuracy
      </h2>
      <p>
        Please provide a complete shipping address with a 6-digit PIN and a
        reachable mobile number. Failed deliveries due to incorrect address may
        require re-shipment charges.
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Contact
      </h2>
      <p>
        {COMPANY.legalName}
        <br />
        {COMPANY.addressLine}
        <br />
        Email:{" "}
        <a
          className="text-[#D4AF37] underline"
          href={`mailto:${COMPANY.email}`}
        >
          {COMPANY.email}
        </a>
        <br />
        Helpline: {COMPANY.phones.map((p) => p.display).join(" · ")}
      </p>
      <p>
        Related:{" "}
        <Link href="/returns" className="text-[#D4AF37] underline">
          Returns &amp; refunds
        </Link>
      </p>
    </PolicyPageShell>
  );
}
