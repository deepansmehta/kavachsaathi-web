import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import {
  BROTHERS,
  BROTHERS_DEDICATION_LINE,
  BROTHERS_MEMORIAL_LINE,
} from "@/lib/brothers";

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
  description: `KavachSaathi — Born from Legacy · Built to Protect. By GDM Technoworld. Dedicated to The Bajaj Brothers of Bhirdana, Fatehabad (Haryana). Five Brothers One Legacy: ${BROTHERS_DEDICATION_LINE}.`,
  keywords: [
    "KavachSaathi",
    "Bajaj Brothers",
    "Bhirdana",
    "Bhirdana Fatehabad",
    "Bajaj Family Bhirdana",
    "Five Brothers One Legacy",
    "Gangadhar Bajaj",
    "Bansi Dhar Bajaj",
    "Surender Bajaj",
    "Narender Bajaj",
    "Pawan Bajaj",
    "GDM Technoworld",
    "Fatehabad Haryana",
    "smart health card India",
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE}/coming-soon` },
  openGraph: {
    title: "KavachSaathi — Coming Soon | Bajaj Brothers · Bhirdana",
    description: `Born from Legacy · Built to Protect. Dedicated to The Bajaj Family of Bhirdana, Fatehabad. ${BROTHERS_MEMORIAL_LINE}`,
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
  description: `KavachSaathi — Born from Legacy · Built to Protect. Dedicated to The Bajaj Brothers and Bajaj Family of Bhirdana, Fatehabad, Haryana. ${BROTHERS_MEMORIAL_LINE}`,
  url: `${SITE}/coming-soon`,
  isPartOf: {
    "@type": "WebSite",
    name: "KavachSaathi",
    url: SITE,
  },
  about: BROTHERS.map((b) => ({
    "@type": "Person",
    name: b.name,
    ...("years" in b && b.years
      ? {
          birthDate: b.years.split(" — ")[0],
          deathDate: b.years.split(" — ")[1],
        }
      : {}),
    homeLocation: {
      "@type": "Place",
      name: "Bhirdana, Fatehabad, Haryana",
    },
  })),
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
