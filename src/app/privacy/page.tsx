import Link from "next/link";

const IS_PROD = process.env.NODE_ENV === "production";
const UPDATED = "1 October 2026";

export const metadata = {
  title: "Privacy Policy | KavachSaathi",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-cream">
      {!IS_PROD && (
        <p className="mb-6 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
          DRAFT — legal review pending
        </p>
      )}

      <p className="mb-6 rounded-xl border border-[#D4AF37]/30 bg-[#141410] p-4 text-sm leading-relaxed text-[#FCE49A]">
        <strong>हिंदी सारांश:</strong> KavachSaathi आपका स्वास्थ्य कार्ड है।
        हम आपका फोटो, आपातकालीन चिकित्सा जानकारी, पहचान पत्र (आधार की केवल
        अंतिम 4 अंक), पता और बीमा विवरण सुरक्षित रखते हैं ताकि स्कैन पर मदद
        मिल सके। डेटा बेचा नहीं जाता। आप /my-profile से सुधार या हटाने का
        अनुरोध कर सकते हैं। शिकायत: gdmtechnoworld@gmail.com
      </p>

      <h1 className="font-rajdhani text-3xl font-bold text-[#D4AF37]">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-[#A8A59C]">Last updated: {UPDATED}</p>

      <section className="mt-8 space-y-4 text-sm leading-relaxed text-[#F0EEE8]">
        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          1. Who we are (Data Fiduciary)
        </h2>
        <p>
          GDM Technoworld Pvt. Ltd., Sector 3, HUDA Sector, Fatehabad, Haryana,
          India. Contact:{" "}
          <a className="text-[#D4AF37] underline" href="mailto:gdmtechnoworld@gmail.com">
            gdmtechnoworld@gmail.com
          </a>
          .
        </p>
        <p className="rounded border border-dashed border-amber-500/40 p-3 text-amber-100">
          <strong>Grievance Officer:</strong>{" "}
          {process.env.GRIEVANCE_OFFICER_NAME?.trim() &&
          process.env.GRIEVANCE_OFFICER_EMAIL?.trim() ? (
            <>
              {process.env.GRIEVANCE_OFFICER_NAME.trim()},{" "}
              <a
                className="underline text-[#D4AF37]"
                href={`mailto:${process.env.GRIEVANCE_OFFICER_EMAIL.trim()}`}
              >
                {process.env.GRIEVANCE_OFFICER_EMAIL.trim()}
              </a>
            </>
          ) : (
            <>
              <span className="font-semibold">[Name]</span>,{" "}
              <span className="font-semibold">[email]</span> — set{" "}
              <code className="text-xs">GRIEVANCE_OFFICER_NAME</code> and{" "}
              <code className="text-xs">GRIEVANCE_OFFICER_EMAIL</code> in the
              environment before enabling activation.
            </>
          )}
        </p>

        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          2. What we collect
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Emergency medical information (blood group, allergies, conditions, medications, contacts)</li>
          <li>Photo of the card holder</li>
          <li>
            Two ID proofs (Aadhaar: only last 4 digits stored; please upload a
            masked Aadhaar from myAadhaar so only last 4 digits are visible)
          </li>
          <li>Address and address proof</li>
          <li>Private insurance and/or government scheme details and card images</li>
          <li>Phone number and a PIN (stored only as a secure hash — we never store your PIN in plain text)</li>
          <li>Access logs when Full Details is viewed (time, mode, hospital/staff if emergency access)</li>
        </ul>

        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          3. Why we collect it
        </h2>
        <p>
          So that anyone who scans your KavachSaathi card in an emergency can
          see life-saving medical information quickly, and so that hospital
          staff (with your PIN or logged emergency access) can use insurance /
          admission documents when needed.
        </p>

        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          4. Who can see what
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Public scan view:</strong> photo, name, emergency medical
            info, insurer name and/or government scheme name (not policy numbers
            or ID numbers).
          </li>
          <li>
            <strong>Full Details with your PIN:</strong> all profile and document
            fields needed for hospital admission.
          </li>
          <li>
            <strong>Hospital emergency access (patient unconscious):</strong>{" "}
            insurance / admission information only — not ID images, ID numbers,
            or address proof. Each use is logged.
          </li>
          <li>
            <strong>Admin:</strong> only when needed for support; revealing ID
            numbers requires confirmation and is logged.
          </li>
        </ul>

        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          5. Where data is stored
        </h2>
        <p>
          Google Firebase / Cloud Storage in the Mumbai region (asia-south1).
          Sensitive fields are encrypted at rest. Document files are private
          (no public bucket access; short-lived signed links only).
        </p>

        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          6. How long we keep data
        </h2>
        <p>
          While your card profile is active. After you delete documents/profile
          or request deletion, we remove associated personal data within 30 days
          (except where law requires a longer record, such as limited access
          logs).
        </p>

        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          7. Your rights (DPDP Act 2023)
        </h2>
        <p>
          You may access, correct, delete documents, withdraw consent, nominate
          another person, or raise a grievance via{" "}
          <Link href="/my-profile" className="text-[#D4AF37] underline">
            /my-profile
          </Link>{" "}
          or email{" "}
          <a className="text-[#D4AF37] underline" href="mailto:gdmtechnoworld@gmail.com">
            gdmtechnoworld@gmail.com
          </a>
          .
        </p>

        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          8. Children
        </h2>
        <p>
          A parent or guardian must create and manage the profile for anyone
          under 18.
        </p>

        <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
          9. Selling / ads / sharing
        </h2>
        <p>
          We do not sell your data. We do not use it for advertising. We share
          it only as described above, or when required by law.
        </p>

        <p className="pt-4 text-[#A8A59C]">
          Also see our{" "}
          <Link href="/terms" className="text-[#D4AF37] underline">
            Terms of Use
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
