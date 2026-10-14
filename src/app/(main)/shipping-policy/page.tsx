import Link from "next/link";
import { COMPANY, DELIVERY, formatInr } from "@/lib/pricing";
import { PolicyPageShell } from "@/components/layout/PolicyPageShell";

export const metadata = {
  title: "Shipping Policy",
  description:
    "KavachSaathi shipping and delivery policy — free India delivery, timelines, and support.",
  robots: { index: true, follow: true },
};

export default function ShippingPolicyPage() {
  return (
    <PolicyPageShell
      title="Shipping & delivery policy"
      hindiSummary="भारत में स्टैंडर्ड डिलीवरी निःशुल्क। भुगतान कन्फर्म के बाद आमतौर पर 7–12 कार्य दिवस। पता सही रखें; देरी पर हमसे संपर्क करें।"
    >
      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        1. Service area
      </h2>
      <p>
        We currently ship KavachSaathi cards within India to the delivery
        address you provide on{" "}
        <Link href="/order" className="text-[#D4AF37] underline">
          /order
        </Link>
        .
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        2. Delivery charges
      </h2>
      <p>
        <strong>{DELIVERY.label}</strong>
        {DELIVERY.chargeInr === 0
          ? ` (${formatInr(0)}).`
          : ` (${formatInr(DELIVERY.chargeInr)}).`}{" "}
        {DELIVERY.note}
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        3. Processing &amp; timelines
      </h2>
      <p>
        Orders are confirmed by our team (call / message) after you submit the
        form. {DELIVERY.eta}. Festival peaks or courier disruptions may add
        delay; we will update you if so.
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        4. Address accuracy
      </h2>
      <p>
        Provide a complete address with PIN code and a reachable phone number.
        Failed deliveries due to incorrect address may require re-shipment
        charges.
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        5. Tracking &amp; support
      </h2>
      <p>
        When a tracking ID is available, we share it on the contact number /
        email linked to your order. For shipping issues contact{" "}
        <a
          className="text-[#D4AF37] underline"
          href={`mailto:${COMPANY.email}`}
        >
          {COMPANY.email}
        </a>{" "}
        or call {COMPANY.phones.map((p) => p.display).join(" / ")}. Working
        hours: {COMPANY.workingHours}.
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        6. Risk of loss
      </h2>
      <p>
        Title and risk pass on successful delivery to the address provided,
        except where courier confirms loss in transit — in that case we will
        reprint and reship after verification.
      </p>
    </PolicyPageShell>
  );
}
