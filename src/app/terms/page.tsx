import Link from "next/link";

const IS_PROD = process.env.NODE_ENV === "production";
const UPDATED = "1 October 2026";

export const metadata = {
  title: "Terms of Use | KavachSaathi",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-cream">
      {!IS_PROD && (
        <p className="mb-6 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
          DRAFT — legal review pending
        </p>
      )}

      <p className="mb-6 rounded-xl border border-[#D4AF37]/30 bg-[#141410] p-4 text-sm leading-relaxed text-[#FCE49A]">
        <strong>हिंदी सारांश:</strong> KavachSaathi एक सूचना सहायक है, चिकित्सा
        सेवा नहीं। प्रोफ़ाइल की सही जानकारी आपकी ज़िम्मेदारी है। कार्ड खो जाए तो
        हमसे संपर्क करें। आपातकालीन पहुँच का दुरुपयोग प्रतिबंधित है और लॉग होता
        है।
      </p>

      <h1 className="font-rajdhani text-3xl font-bold text-[#D4AF37]">
        Terms of Use
      </h1>
      <p className="mt-2 text-sm text-[#A8A59C]">Last updated: {UPDATED}</p>

      <section className="mt-8 space-y-4 text-sm leading-relaxed text-[#F0EEE8]">
        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          1. Information aid — not a medical service
        </h2>
        <p>
          KavachSaathi helps share emergency and admission-related information
          via a scanned card. It is not a doctor, hospital, ambulance service,
          or insurance provider. Always seek qualified medical help in an
          emergency (for example, dial 108 / local emergency numbers).
        </p>

        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          2. Accuracy is your responsibility
        </h2>
        <p>
          You (or a parent/guardian for a minor) are responsible for keeping
          profile and document information accurate and up to date. Outdated or
          incorrect data may harm emergency response.
        </p>

        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          3. Lost or stolen card
        </h2>
        <p>
          Contact us immediately at{" "}
          <a className="text-[#D4AF37] underline" href="mailto:gdmtechnoworld@gmail.com">
            gdmtechnoworld@gmail.com
          </a>{" "}
          or via{" "}
          <Link href="/my-profile" className="text-[#D4AF37] underline">
            /my-profile
          </Link>{" "}
          so we can help block or reset access.
        </p>

        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          4. Misuse of emergency access
        </h2>
        <p>
          Hospital emergency Full Details access is only for genuine treatment
          of the card holder. Misuse is prohibited, logged, and may be reported
          to authorities.
        </p>

        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          5. Acceptable use
        </h2>
        <p>
          Do not attempt to break into accounts, upload malware, scrape private
          data, or use the service for fraud. We may suspend cards that violate
          these terms.
        </p>

        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          6. Limitation
        </h2>
        <p>
          To the extent allowed by law, GDM Technoworld Pvt. Ltd. is not liable
          for outcomes of medical decisions made using information on the card.
          The card is a convenience tool; verify critical details when possible.
        </p>

        <p className="pt-4 text-[#A8A59C]">
          Also see our{" "}
          <Link href="/privacy" className="text-[#D4AF37] underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
