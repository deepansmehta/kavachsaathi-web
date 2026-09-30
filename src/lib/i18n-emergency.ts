export type Lang = "en" | "hi";

const DICT = {
  emergencyMedical: { en: "Emergency medical info", hi: "आपातकालीन चिकित्सा जानकारी" },
  critical: { en: "CRITICAL", hi: "गंभीर" },
  criticalAlerts: { en: "Critical alerts", hi: "गंभीर चेतावनियाँ" },
  bloodGroup: { en: "Blood group", hi: "ब्लड ग्रुप" },
  allergies: { en: "Allergies", hi: "एलर्जी" },
  chronic: { en: "Chronic conditions", hi: "दीर्घकालिक रोग" },
  medications: { en: "Medications", hi: "दवाइयाँ" },
  contacts: { en: "Emergency contacts", hi: "आपातकालीन संपर्क" },
  familyDoctor: { en: "Family doctor", hi: "पारिवारिक चिकित्सक" },
  preferredHospital: { en: "Preferred hospital", hi: "पसंदीदा अस्पताल" },
  organDonor: { en: "Organ donor", hi: "अंगदाता" },
  city: { en: "City", hi: "शहर" },
  noneReported: { en: "None reported", hi: "कोई जानकारी नहीं" },
  notProvided: { en: "Not provided", hi: "उपलब्ध नहीं" },
  yes: { en: "Yes", hi: "हाँ" },
  no: { en: "No", hi: "नहीं" },
  call: { en: "Call", hi: "कॉल" },
  whatsapp: { en: "WhatsApp", hi: "व्हाट्सऐप" },
  callAmbulance: { en: "Call 108 Ambulance", hi: "108 एम्बुलेंस कॉल करें" },
  nearbyHospitals: { en: "Nearby hospitals", hi: "नज़दीकी अस्पताल" },
  shareLocation: {
    en: "Share your location to help family find you? (optional)",
    hi: "परिवार को खोजने में मदद के लिए स्थान साझा करें? (वैकल्पिक)",
  },
  allowLocation: { en: "Allow", hi: "अनुमति दें" },
  dismiss: { en: "Not now", hi: "अभी नहीं" },
  locationShared: { en: "Location shared for maps", hi: "मानचित्र के लिए स्थान साझा" },
  thisIsEmergency: {
    en: "This is an emergency",
    hi: "यह आपात स्थिति है",
  },
  emergencySent: {
    en: "Emergency flagged for the card owner",
    hi: "कार्ड मालिक को आपात संकेत भेजा गया",
  },
  blockedTitle: { en: "Card blocked", hi: "कार्ड ब्लॉक है" },
  blockedBody: {
    en: "This card has been blocked by its owner. If you found it, please contact the owner or KavachSaathi support.",
    hi: "इस कार्ड को मालिक ने ब्लॉक कर दिया है। यदि आपको मिला है, तो मालिक या कवचसाथी सपोर्ट से संपर्क करें।",
  },
  tagline: { en: "Protect · Inform · Save", hi: "रक्षा · सूचना · सुरक्षा" },
} as const;

export type DictKey = keyof typeof DICT;

export function t(key: DictKey, lang: Lang): string {
  return DICT[key][lang] || DICT[key].en;
}

export function loadLang(): Lang {
  try {
    const v = localStorage.getItem("kavach_lang");
    if (v === "hi" || v === "en") return v;
  } catch {
    /* ignore */
  }
  return "en";
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem("kavach_lang", lang);
  } catch {
    /* ignore */
  }
}
