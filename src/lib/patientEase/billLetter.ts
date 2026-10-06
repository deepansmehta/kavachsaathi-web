/** F17 — Bill request letter + bill-check checklist */

export type BillLetterInput = {
  patientName: string;
  hospital: string;
  ipUhid: string;
  admissionDate: string;
};

export const BILL_CHECK_ITEMS: { id: string; label: string }[] = [
  { id: "duplicates", label: "No duplicate line items" },
  { id: "consumables_pkg", label: "Consumables not charged separately inside packages" },
  { id: "room_vs_limit", label: "Room category matches entitlement / room-rent limit" },
  { id: "meds_not_given", label: "Medicines billed were actually given" },
  { id: "after_discharge", label: "No charges after discharge time" },
];

export const NOT_LEGAL_ADVICE =
  "Not legal advice. This is a courtesy template for requesting an itemized bill.";

export function billLetterEnglish(i: BillLetterInput): string {
  return [
    "To,",
    "The Billing Department,",
    i.hospital || "[Hospital name]",
    "",
    "Subject: Request for fully itemized final bill",
    "",
    `Dear Sir/Madam,`,
    "",
    `I am writing regarding the hospitalisation of ${i.patientName || "[Patient name]"} (IP/UHID: ${i.ipUhid || "[IP/UHID]"}), admitted on ${i.admissionDate || "[admission date]"}.`,
    "",
    "Kindly provide a fully itemized final bill showing each charge separately (room, procedures, consumables, pharmacy, diagnostics, etc.) to enable insurance / reimbursement verification.",
    "",
    "Thank you for your assistance.",
    "",
    "Yours faithfully,",
    i.patientName || "[Name]",
    "",
    NOT_LEGAL_ADVICE,
  ].join("\n");
}

export function billLetterHindi(i: BillLetterInput): string {
  return [
    "प्रति,",
    "बिलिंग विभाग,",
    i.hospital || "[अस्पताल का नाम]",
    "",
    "विषय: पूर्ण रूप से आइटमाइज़्ड अंतिम बिल का अनुरोध",
    "",
    "महोदय/महोदया,",
    "",
    `मैं ${i.patientName || "[मरीज का नाम]"} (आईपी/यूएचआईडी: ${i.ipUhid || "[IP/UHID]"}) के अस्पताल में भर्ती होने (प्रवेश तिथि: ${i.admissionDate || "[तिथि]"}) के संबंध में लिख रहा/रही हूँ।`,
    "",
    "कृपया पूर्ण रूप से आइटमाइज़्ड अंतिम बिल प्रदान करें जिसमें प्रत्येक शुल्क अलग-अलग दर्शाया गया हो, ताकि बीमा / प्रतिपूर्ति सत्यापन संभव हो सके।",
    "",
    "धन्यवाद।",
    "",
    "भवदीय,",
    i.patientName || "[नाम]",
    "",
    "यह कानूनी सलाह नहीं है। यह आइटमाइज़्ड बिल माँगने हेतु सहायक प्रारूप है।",
  ].join("\n");
}
