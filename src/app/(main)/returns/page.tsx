import Link from "next/link";
import { COMPANY } from "@/lib/pricing";
import { PolicyPageShell } from "@/components/layout/PolicyPageShell";

export const metadata = {
  title: "Return, Refund & Cancellation Policy",
  description:
    "KavachSaathi cancellation, return, and refund policy — GDM Technoworld Pvt. Ltd.",
  robots: { index: true, follow: true },
};

export default function ReturnsPage() {
  return (
    <PolicyPageShell
      title="Return, Refund & Cancellation Policy"
      updated="28 October 2026"
      hindiSummary="डिस्पैच से पहले रद्द करने पर पूरा रिफंड। क्षतिग्रस्त / गलत कार्ड का मुफ़्त रिप्लेसमेंट (7 दिन, बिना एक्टिवेट)। एक्टिवेटेड कार्ड वापस नहीं।"
    >
      <p>
        Purchases of KavachSaathi cards sold by{" "}
        <strong>{COMPANY.legalName}</strong> via{" "}
        <Link href="/order" className="text-[#D4AF37] underline">
          kavachsaathi.in/order
        </Link>
        .
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Cancellation
      </h2>
      <p>
        Orders can be cancelled <strong>before dispatch</strong> for a{" "}
        <strong>full refund</strong>. Email{" "}
        <a
          className="text-[#D4AF37] underline"
          href={`mailto:${COMPANY.email}`}
        >
          {COMPANY.email}
        </a>{" "}
        with your order number, or call {COMPANY.phones.map((p) => p.display).join(" / ")}.
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Returns
      </h2>
      <p>
        KavachSaathi is a <strong>personalised</strong> emergency health card
        (unique QR / activation mapping). Returns are accepted{" "}
        <strong>only</strong> for damaged, defective, or wrong items,{" "}
        <strong>within 7 days of delivery</strong>, and only if the card is{" "}
        <strong>unactivated</strong>. A <strong>free replacement</strong> is
        provided after verification (photos + order number).
      </p>
      <p>
        <strong>Activated cards cannot be returned</strong> for privacy and
        security reasons.
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Refunds
      </h2>
      <p>
        Where a refund applies, it is processed to the{" "}
        <strong>original payment method</strong> within{" "}
        <strong>5–7 business days</strong> after approval.
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        How to raise a request
      </h2>
      <p>
        Email{" "}
        <a
          className="text-[#D4AF37] underline"
          href={`mailto:${COMPANY.email}?subject=KavachSaathi%20return%20%2F%20refund`}
        >
          {COMPANY.email}
        </a>{" "}
        with your <strong>order number</strong>, issue description, and photos
        (if damaged/defective).
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Company
      </h2>
      <p>
        {COMPANY.legalName}
        <br />
        {COMPANY.addressLine}
        <br />
        Helpline: {COMPANY.phones.map((p) => p.display).join(" · ")}
      </p>
    </PolicyPageShell>
  );
}
