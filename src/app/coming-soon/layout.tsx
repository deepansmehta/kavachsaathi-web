import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://kavachsaathi.in";

export const metadata: Metadata = {
  title: "KavachSaathi Coming Soon — Bajaj Brothers of Bhirdana, Fatehabad",
  description:
    "KavachSaathi — Born from Legacy · Built to Protect. By GDM Technoworld. Dedicated to The Bajaj Brothers of Bhirdana, Fatehabad (Haryana). Five Brothers One Legacy: Shri Ganga Dhar Mehta Ji (1949–2011), Shri Narender Bajaj Ji, Shri Surender Bajaj Ji, Shri Bansi Dhar Bajaj Ji, and Shri Pawan Bajaj Ji (1962–2015).",
  keywords: [
    "KavachSaathi",
    "Bajaj Brothers",
    "Bhirdana",
    "Bhirdana Fatehabad",
    "Bajaj Family Bhirdana",
    "Five Brothers One Legacy",
    "Ganga Dhar Mehta",
    "Pawan Bajaj",
    "Narender Bajaj",
    "Surender Bajaj",
    "Bansi Dhar Bajaj",
    "GDM Technoworld",
    "Fatehabad Haryana",
    "smart health card India",
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE}/coming-soon` },
  openGraph: {
    title: "KavachSaathi — Coming Soon | Bajaj Brothers · Bhirdana",
    description:
      "Born from Legacy · Built to Protect. Dedicated to The Bajaj Family of Bhirdana, Fatehabad. In loving memory of Shri Ganga Dhar Mehta Ji (1949–2011) and Shri Pawan Bajaj Ji (1962–2015).",
    url: `${SITE}/coming-soon`,
    siteName: "KavachSaathi",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "KavachSaathi — Bajaj Brothers of Bhirdana, Fatehabad",
    description:
      "Born from Legacy · Built to Protect. Five Brothers · One Legacy · Bhirdana, Fatehabad.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "KavachSaathi Coming Soon — The Bajaj Brothers of Bhirdana",
  description:
    "KavachSaathi — Born from Legacy · Built to Protect. Dedicated to The Bajaj Brothers and Bajaj Family of Bhirdana, Fatehabad, Haryana. In loving memory of Shri Ganga Dhar Mehta Ji (1949–2011) and Shri Pawan Bajaj Ji (1962–2015).",
  url: `${SITE}/coming-soon`,
  isPartOf: {
    "@type": "WebSite",
    name: "KavachSaathi",
    url: SITE,
  },
  about: [
    {
      "@type": "Person",
      name: "Shri Ganga Dhar Mehta Ji",
      birthDate: "1949",
      deathDate: "2011",
      homeLocation: {
        "@type": "Place",
        name: "Bhirdana, Fatehabad, Haryana",
      },
    },
    {
      "@type": "Person",
      name: "Shri Narender Bajaj Ji",
      homeLocation: {
        "@type": "Place",
        name: "Bhirdana, Fatehabad, Haryana",
      },
    },
    {
      "@type": "Person",
      name: "Shri Surender Bajaj Ji",
      homeLocation: {
        "@type": "Place",
        name: "Bhirdana, Fatehabad, Haryana",
      },
    },
    {
      "@type": "Person",
      name: "Shri Bansi Dhar Bajaj Ji",
      homeLocation: {
        "@type": "Place",
        name: "Bhirdana, Fatehabad, Haryana",
      },
    },
    {
      "@type": "Person",
      name: "Shri Pawan Bajaj Ji",
      birthDate: "1962",
      deathDate: "2015",
      homeLocation: {
        "@type": "Place",
        name: "Bhirdana, Fatehabad, Haryana",
      },
    },
  ],
  publisher: {
    "@type": "Organization",
    name: "GDM Technoworld Pvt. Ltd.",
    url: SITE,
  },
};

/** Dead-end shell: no chrome from parent beyond root fonts/styles */
export default function ComingSoonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={cormorant.variable}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </div>
  );
}
