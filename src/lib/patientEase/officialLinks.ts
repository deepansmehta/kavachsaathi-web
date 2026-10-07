/**
 * Official government / public-health links for Pack 2 (F22–F24).
 * Only URLs verified HTTP 200 (curl -L, 2026-10-06) are marked verified.
 *
 * The OfficialScheme shape is the canonical type used by F22 scheme guide.
 * Added in Pack 2 implementation: E_RAKT_KOSH object + JAN_AUSHADHI_INFO object.
 */

export type OfficialScheme = {
  id: string;
  nameEn: string;
  nameHi: string;
  eligibilityEn: string;
  eligibilityHi: string;
  officialUrl: string;
  eligibilityCheckUrl?: string;
  hospitalsUrl?: string;
  helpline?: string;
  /** false = do not show until verified 200 */
  verified: boolean;
};

/** @deprecated Use OfficialScheme. Alias for code referencing SchemeRecord. */
export type SchemeRecord = OfficialScheme;

export const OFFICIAL_LINKS = {
  pmjay: "https://nha.gov.in/PM-JAY",
  pmjayEligibility: "https://beneficiary.nha.gov.in/",
  pmjayHospitals: "https://hospitals.pmjay.gov.in/",
  echs: "https://echs.gov.in/",
  esic: "https://www.esic.gov.in/",
  eRaktKosh: "https://eraktkosh.mohfw.gov.in/",
  janAushadhi: "https://janaushadhi.gov.in/",
  janAushadhiLocator: "https://janaushadhi.gov.in/KendraLocation.aspx",
  mySchemeAbPmjay: "https://www.myscheme.gov.in/schemes/ab-pmjay",
  haryanaHealth: "https://haryanahealth.gov.in/",
  nhaHome: "https://nha.gov.in/",
} as const;

export const SCHEMES: OfficialScheme[] = [
  {
    id: "pmjay",
    nameEn: "Ayushman Bharat PM-JAY",
    nameHi: "आयुष्मान भारत पीएम-जय",
    eligibilityEn:
      "National public health assurance scheme (NHA). Check eligibility and e-card on the official beneficiary portal.",
    eligibilityHi:
      "राष्ट्रीय सार्वजनिक स्वास्थ्य आश्वासन योजना (एनएचए)। पात्रता व ई-कार्ड आधिकारिक लाभार्थी पोर्टल पर जाँचें।",
    officialUrl: OFFICIAL_LINKS.pmjay,
    eligibilityCheckUrl: OFFICIAL_LINKS.pmjayEligibility,
    hospitalsUrl: OFFICIAL_LINKS.pmjayHospitals,
    helpline: "14555",
    verified: true,
  },
  {
    id: "vay-vandana",
    nameEn: "Ayushman Vay Vandana (70+)",
    nameHi: "आयुष्मान वय वंदना (70+)",
    eligibilityEn:
      "Senior-citizen coverage under Ayushman Bharat / NHA. Confirm current rules on the official PM-JAY and myScheme pages.",
    eligibilityHi:
      "आयुष्मान भारत / एनएचए के अंतर्गत वरिष्ठ नागरिक कवरेज। वर्तमान नियम आधिकारिक पीएम-जय व myScheme पर जाँचें।",
    officialUrl: OFFICIAL_LINKS.pmjay,
    eligibilityCheckUrl: OFFICIAL_LINKS.mySchemeAbPmjay,
    hospitalsUrl: OFFICIAL_LINKS.pmjayHospitals,
    helpline: "14555",
    verified: true,
  },
  {
    id: "echs",
    nameEn: "ECHS",
    nameHi: "ईसीएचएस",
    eligibilityEn:
      "Ex-Servicemen Contributory Health Scheme. Details on the official ECHS website.",
    eligibilityHi:
      "पूर्व सैनिक अंशदायी स्वास्थ्य योजना। विवरण आधिकारिक ईसीएचएस वेबसाइट पर।",
    officialUrl: OFFICIAL_LINKS.echs,
    verified: true,
  },
  {
    id: "esic",
    nameEn: "ESIC",
    nameHi: "ईएसआईसी",
    eligibilityEn:
      "Employees' State Insurance Corporation medical benefits. See the official ESIC website.",
    eligibilityHi:
      "कर्मचारी राज्य बीमा निगम चिकित्सा लाभ। आधिकारिक ईएसआईसी वेबसाइट देखें।",
    officialUrl: OFFICIAL_LINKS.esic,
    verified: true,
  },
  {
    id: "haryana",
    nameEn: "Haryana state health (official portal)",
    nameHi: "हरियाणा राज्य स्वास्थ्य (आधिकारिक पोर्टल)",
    eligibilityEn:
      "Haryana Health Department official portal. Confirm current state scheme name and eligibility there (e.g. Chirayu / state programmes).",
    eligibilityHi:
      "हरियाणा स्वास्थ्य विभाग का आधिकारिक पोर्टल। वर्तमान राज्य योजना का नाम व पात्रता वहीं जाँचें।",
    officialUrl: OFFICIAL_LINKS.haryanaHealth,
    verified: true,
  },
  // CGHS omitted until an official URL returns HTTP 200 from this environment
];

/** String URL — kept for backward compatibility */
export const JAN_AUSHADHI_LOCATOR = OFFICIAL_LINKS.janAushadhiLocator;
/** String URL — kept for backward compatibility */
export const E_RAKTKOSH_URL = OFFICIAL_LINKS.eRaktKosh;

/** Rich object for Pack 2 components (NeedBloodButton, schemes page, etc.) */
export const E_RAKT_KOSH = {
  labelEn: "e-RaktKosh — National Blood Transfusion Council",
  labelHi: "e-RaktKosh — राष्ट्रीय रक्त आधान परिषद",
  url: OFFICIAL_LINKS.eRaktKosh,
  descEn:
    "Official Ministry of Health & Family Welfare portal to locate blood banks and check real-time blood stock across India.",
  descHi:
    "भारत भर में रक्त बैंक खोजने और रीयल-टाइम रक्त उपलब्धता जांचने के लिए स्वास्थ्य एवं परिवार कल्याण मंत्रालय का आधिकारिक पोर्टल।",
} as const;

/** Rich object for Pack 2 components */
export const JAN_AUSHADHI_INFO = {
  labelEn: "Jan Aushadhi — Affordable Generic Medicines",
  labelHi: "जन औषधि — सस्ती जेनेरिक दवाएं",
  url: OFFICIAL_LINKS.janAushadhi,
  locatorUrl: OFFICIAL_LINKS.janAushadhiLocator,
  descEn:
    "Pradhan Mantri Bhartiya Janaushadhi Pariyojana — quality generic medicines at affordable prices. Find nearest Janaushadhi Kendra.",
  descHi:
    "प्रधानमंत्री भारतीय जनऔषधि परियोजना — किफायती मूल्य पर गुणवत्तापूर्ण जेनेरिक दवाएं। निकटतम जनऔषधि केंद्र खोजें।",
} as const;

export function verifiedSchemes(): OfficialScheme[] {
  return SCHEMES.filter((s) => s.verified);
}

export function schemesFooterNote(lang: "en" | "hi" = "en"): string {
  return lang === "hi"
    ? "आधिकारिक पोर्टल पर सत्यापित करें।"
    : "Verify on the official portal.";
}

/** Lookup by id */
export function findScheme(id: string): OfficialScheme | undefined {
  return SCHEMES.find((s) => s.id === id);
}
