import { COMPANY } from "@/lib/pricing";
import { PolicyPageShell } from "@/components/layout/PolicyPageShell";
import { ContactForm } from "@/components/contact/ContactForm";

export const metadata = {
  title: "Contact Us",
  description:
    "Contact GDM Technoworld Pvt. Ltd. for KavachSaathi support — Fatehabad, Haryana.",
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <PolicyPageShell
      title="Contact Us"
      updated="28 October 2026"
      hindiSummary="KavachSaathi सहायता — पता, फोन, ईमेल और सोम–शनि 10 AM–6 PM IST। नीचे फॉर्म से लिखें।"
    >
      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Business details
      </h2>
      <p>
        <strong>{COMPANY.legalName}</strong>
        <br />
        {COMPANY.addressLine}
      </p>
      <p>
        Website:{" "}
        <a className="text-[#D4AF37] underline" href={COMPANY.siteUrl}>
          kavachsaathi.in
        </a>
        <br />
        Corporate:{" "}
        <a
          className="text-[#D4AF37] underline"
          href={COMPANY.website}
          target="_blank"
          rel="noopener noreferrer"
        >
          {COMPANY.website.replace(/^https:\/\/(www\.)?/, "")}
        </a>
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Email
      </h2>
      <p>
        <a
          className="text-[#D4AF37] underline"
          href={`mailto:${COMPANY.email}`}
        >
          {COMPANY.email}
        </a>
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Phone / Helpline
      </h2>
      <ul className="list-disc space-y-2 pl-5">
        {COMPANY.phones.map((p) => (
          <li key={p.tel}>
            <a className="text-[#D4AF37] underline" href={`tel:${p.tel}`}>
              {p.display}
            </a>
          </li>
        ))}
      </ul>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Support hours
      </h2>
      <p>Mon–Sat, 10 AM–6 PM IST</p>
      <p className="text-[#A8A59C]">{COMPANY.closedNote}</p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Send a message
      </h2>
      <ContactForm />
    </PolicyPageShell>
  );
}
