import type { ClaimType, PolicyType } from "./types";

export const POLICY_TYPE_LABELS: Record<
  PolicyType,
  { en: string; hi: string }
> = {
  health: { en: "Health", hi: "स्वास्थ्य" },
  life: { en: "Life", hi: "जीवन" },
  motor: { en: "Motor", hi: "मोटर" },
  personal_accident: { en: "Personal Accident", hi: "व्यक्तिगत दुर्घटना" },
  term: { en: "Term Life", hi: "टर्म लाइफ" },
  travel: { en: "Travel", hi: "यात्रा" },
  ayushman_pmjay: {
    en: "Ayushman Bharat PM-JAY",
    hi: "आयुष्मान भारत पीएम-जेएवाई",
  },
  esic: { en: "ESIC", hi: "ईएसआईसी" },
  cghs: { en: "CGHS", hi: "सीजीएचएस" },
  state_scheme: { en: "State Scheme", hi: "राज्य योजना" },
  pmjjby: { en: "PMJJBY", hi: "पीएमजेजेबीवाई" },
  pmsby: { en: "PMSBY", hi: "पीएमएसबीवाई" },
  other: { en: "Other", hi: "अन्य" },
};

export const CLAIM_TYPE_LABELS: Record<ClaimType, { en: string; hi: string }> =
  {
    cashless_hospitalisation: {
      en: "Cashless hospitalisation",
      hi: "कैशलेस अस्पताल में भर्ती",
    },
    reimbursement: { en: "Reimbursement", hi: "प्रतिपूर्ति" },
    accident_fir: { en: "Accident / FIR", hi: "दुर्घटना / एफआईआर" },
    death_claim: { en: "Death claim (life)", hi: "मृत्यु दावा (जीवन)" },
    motor_accident: { en: "Motor accident", hi: "मोटर दुर्घटना" },
  };

export const CLAIM_STATUS_LABELS: Record<
  string,
  { en: string; hi: string }
> = {
  intimated: { en: "Intimated", hi: "सूचित" },
  documents_submitted: {
    en: "Documents submitted",
    hi: "दस्तावेज़ जमा",
  },
  under_review: { en: "Under review", hi: "समीक्षा में" },
  approved: { en: "Approved", hi: "स्वीकृत" },
  settled: { en: "Settled", hi: "निपटाया" },
  rejected: { en: "Rejected", hi: "अस्वीकृत" },
};

/** Suggestion names only — no helplines hardcoded */
export const INSURER_NAME_SUGGESTIONS = [
  "LIC",
  "New India Assurance",
  "United India Insurance",
  "National Insurance",
  "Oriental Insurance",
  "Star Health",
  "Niva Bupa",
  "Care Health",
  "HDFC ERGO",
  "ICICI Lombard",
  "Bajaj Allianz",
  "Tata AIG",
  "SBI General",
  "Go Digit",
  "Aditya Birla Health",
  "ManipalCigna",
  "HDFC Life",
  "SBI Life",
  "ICICI Prudential",
  "Max Life",
  "Axis Max Life",
] as const;

export const POLICY_LEGAL_FOOTER =
  "KavachSaathi does not sell insurance. Policy information is entered by the cardholder.";

export const POLICY_LEGAL_FOOTER_HI =
  "कवचसाथी बीमा नहीं बेचता। पॉलिसी जानकारी कार्डधारक द्वारा दर्ज की जाती है।";

export const EXPIRING_SOON_DAYS = 30;
