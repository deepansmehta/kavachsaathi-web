import type { ClaimType } from "./types";

export type ChecklistItem = {
  id: string;
  en: string;
  hi: string;
};

const CASHLESS: ChecklistItem[] = [
  {
    id: "c1",
    en: "Call TPA / cashless helpline before / at admission",
    hi: "भर्ती से पहले / पर टीपीए / कैशलेस हेल्पलाइन पर कॉल करें",
  },
  {
    id: "c2",
    en: "Carry e-card / policy copy and photo ID",
    hi: "ई-कार्ड / पॉलिसी कॉपी और फोटो आईडी साथ रखें",
  },
  {
    id: "c3",
    en: "Get pre-authorisation number from hospital desk",
    hi: "अस्पताल डेस्क से प्री-ऑथराइज़ेशन नंबर लें",
  },
  {
    id: "c4",
    en: "Keep doctor notes and investigation reports",
    hi: "डॉक्टर नोट्स और जाँच रिपोर्ट संभाल कर रखें",
  },
  {
    id: "c5",
    en: "At discharge, settle only non-payable / co-pay amounts",
    hi: "डिस्चार्ज पर केवल नॉन-पेएबल / को-पे राशि जमा करें",
  },
];

const REIMBURSEMENT: ChecklistItem[] = [
  {
    id: "r1",
    en: "Intimate claim within insurer timelines",
    hi: "बीमाकर्ता की समय-सीमा में दावा सूचित करें",
  },
  {
    id: "r2",
    en: "Collect discharge summary, bills, receipts",
    hi: "डिस्चार्ज सारांश, बिल, रसीदें इकट्ठा करें",
  },
  {
    id: "r3",
    en: "Fill claim form and attach cancelled cheque / bank details",
    hi: "दावा फॉर्म भरें और कैंसल्ड चेक / बैंक विवरण जोड़ें",
  },
  {
    id: "r4",
    en: "Submit prescriptions and investigation reports",
    hi: "प्रिस्क्रिप्शन और जाँच रिपोर्ट जमा करें",
  },
  {
    id: "r5",
    en: "Note claim number and follow up weekly",
    hi: "दावा नंबर नोट करें और साप्ताहिक फॉलो-अप करें",
  },
];

const ACCIDENT_FIR: ChecklistItem[] = [
  {
    id: "a1",
    en: "File FIR / GD and keep a certified copy",
    hi: "एफआईआर / जीडी दर्ज करें और प्रमाणित प्रति रखें",
  },
  {
    id: "a2",
    en: "Intimate insurer / TPA immediately",
    hi: "तुरंत बीमाकर्ता / टीपीए को सूचित करें",
  },
  {
    id: "a3",
    en: "Keep MLC / hospital records and photos of scene if safe",
    hi: "एमएलसी / अस्पताल रिकॉर्ड और सुरक्षित हो तो दृश्य की फोटो रखें",
  },
  {
    id: "a4",
    en: "Submit police documents with claim pack",
    hi: "दावा पैक के साथ पुलिस दस्तावेज़ जमा करें",
  },
];

const DEATH: ChecklistItem[] = [
  {
    id: "d1",
    en: "Obtain death certificate",
    hi: "मृत्यु प्रमाण पत्र प्राप्त करें",
  },
  {
    id: "d2",
    en: "Intimate life insurer with policy number",
    hi: "पॉलिसी नंबर के साथ जीवन बीमाकर्ता को सूचित करें",
  },
  {
    id: "d3",
    en: "Nominee KYC + bank details + original policy bond if asked",
    hi: "नॉमिनी केवाईसी + बैंक विवरण + माँग पर मूल पॉलिसी बॉन्ड",
  },
  {
    id: "d4",
    en: "Track claim status until settlement",
    hi: "निपटान तक दावा स्थिति ट्रैक करें",
  },
];

const MOTOR: ChecklistItem[] = [
  {
    id: "m1",
    en: "Photograph vehicle damage and spot",
    hi: "वाहन क्षति और स्थान की फोटो लें",
  },
  {
    id: "m2",
    en: "Intimate motor insurer / app and get surveyor visit",
    hi: "मोटर बीमाकर्ता / ऐप को सूचित करें और सर्वेयर विज़िट लें",
  },
  {
    id: "m3",
    en: "Keep FIR if third-party injury / theft",
    hi: "थर्ड-पार्टी चोट / चोरी पर एफआईआर रखें",
  },
  {
    id: "m4",
    en: "Repair estimate + final bills for claim",
    hi: "दावे के लिए मरम्मत अनुमान + अंतिम बिल",
  },
];

export function checklistForClaimType(type: ClaimType): ChecklistItem[] {
  switch (type) {
    case "cashless_hospitalisation":
      return CASHLESS;
    case "reimbursement":
      return REIMBURSEMENT;
    case "accident_fir":
      return ACCIDENT_FIR;
    case "death_claim":
      return DEATH;
    case "motor_accident":
      return MOTOR;
    default:
      return REIMBURSEMENT;
  }
}
