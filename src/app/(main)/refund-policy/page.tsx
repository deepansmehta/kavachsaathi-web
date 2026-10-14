import Link from "next/link";
import { COMPANY } from "@/lib/pricing";
import { PolicyPageShell } from "@/components/layout/PolicyPageShell";

export const metadata = {
  title: "Refund Policy",
  description:
    "KavachSaathi refund and cancellation policy — GDM Technoworld Pvt. Ltd.",
  robots: { index: true, follow: true },
};

export default function RefundPolicyPage() {
  return (
    <PolicyPageShell
      title="Refund & cancellation policy"
      hindiSummary="ऑर्डर कन्फर्म / डिस्पैच से पहले रद्द कर सकते हैं। प्रिंट या शिप के बाद कार्ड की प्रकृति के कारण रिफंड सीमित हैं। समस्या हो तो हमें तुरंत लिखें।"
    >
      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        1. Who this applies to
      </h2>
      <p>
        Purchases of KavachSaathi physical cards and packs sold by{" "}
        {COMPANY.legalName} via{" "}
        <Link href="/order" className="text-[#D4AF37] underline">
          kavachsaathi.in/order
        </Link>{" "}
        or authorised channels.
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        2. Cancellation before dispatch
      </h2>
      <p>
        You may cancel an order before it is confirmed for printing / dispatch.
        Contact us at{" "}
        <a
          className="text-[#D4AF37] underline"
          href={`mailto:${COMPANY.email}`}
        >
          {COMPANY.email}
        </a>{" "}
        or call {COMPANY.phones.map((p) => p.display).join(" / ")} with your
        order number. If payment was collected, we will refund the paid amount
        to the original method within 5–10 business days after approval.
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        3. After printing or dispatch
      </h2>
      <p>
        Each card is personalised (unique QR / activation mapping). Once printed
        or handed to courier, cancellations and refunds are generally not
        available, except where required by law or where we shipped a defective
        / wrong item.
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        4. Defective, damaged, or wrong item
      </h2>
      <p>
        Report within 7 days of delivery with clear photos and your order
        number. We will replace the card at no extra cost or refund at our
        discretion after verification.
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        5. Digital access / renewal
      </h2>
      <p>
        Annual renewal fees for continued digital access are non-refundable once
        the renewal period has been activated on your Health ID, except where
        required by applicable law.
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        6. How to request
      </h2>
      <p>
        Email{" "}
        <a
          className="text-[#D4AF37] underline"
          href={`mailto:${COMPANY.email}`}
        >
          {COMPANY.email}
        </a>{" "}
        with subject “Refund request”, order number, and reason. See also{" "}
        <Link href="/contact" className="text-[#D4AF37] underline">
          Contact
        </Link>
        .
      </p>
    </PolicyPageShell>
  );
}
