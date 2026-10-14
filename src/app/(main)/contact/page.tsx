import { COMPANY } from "@/lib/pricing";
import { PolicyPageShell } from "@/components/layout/PolicyPageShell";

export const metadata = {
  title: "Contact",
  description:
    "Contact GDM Technoworld Pvt. Ltd. for KavachSaathi support — Fatehabad, Haryana.",
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <PolicyPageShell
      title="Contact us"
      hindiSummary="KavachSaathi सहायता के लिए GDM Technoworld से संपर्क करें — पता, फोन, ईमेल और कार्य समय नीचे हैं।"
    >
      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Company
      </h2>
      <p>
        <strong>{COMPANY.legalName}</strong>
        <br />
        {COMPANY.addressLine}
        <br />
        {COMPANY.country}
      </p>
      <p>
        Corporate website:{" "}
        <a
          className="text-[#D4AF37] underline"
          href={COMPANY.website}
          target="_blank"
          rel="noopener noreferrer"
        >
          {COMPANY.website.replace(/^https:\/\//, "")}
        </a>
      </p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Phone
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
        Working hours
      </h2>
      <p>{COMPANY.workingHours}</p>
      <p className="text-[#A8A59C]">{COMPANY.closedNote}</p>

      <h2 className="font-rajdhani text-xl font-semibold text-[#FCE49A]">
        Orders &amp; activation
      </h2>
      <p>
        For new card orders use{" "}
        <a className="text-[#D4AF37] underline" href="/order">
          /order
        </a>
        . For profile help after activation, use{" "}
        <a className="text-[#D4AF37] underline" href="/my-profile">
          /my-profile
        </a>{" "}
        or email us with your Health ID (never send your PIN).
      </p>
    </PolicyPageShell>
  );
}
