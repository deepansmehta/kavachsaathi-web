/**
 * F17 — Bill Request Letter
 * English + Hindi letter text builders and bill verification checklist.
 * NOT legal advice.
 */

export type BillLetterParams = {
  patientName: string;
  hospitalName: string;
  admissionDate: string;
  dischargeDate: string;
  healthId: string;
  policyNumber?: string;
  tpaName?: string;
  generatedDate: string;
};

export const BILL_LETTER_DISCLAIMER =
  "This letter is generated as a convenience aid only and does not constitute legal advice. Please consult a legal or insurance professional for formal disputes.";

export const BILL_CHECK_ITEMS: { id: string; label: string; labelHi: string }[] = [
  {
    id: "itemised_bill",
    label: "Request itemised / detailed bill (not just summary)",
    labelHi: "मदवार / विस्तृत बिल मांगें (केवल सारांश नहीं)",
  },
  {
    id: "consumables_breakup",
    label: "Check consumables breakup — gloves/cotton often not covered",
    labelHi: "उपभोग्य सामग्री विवरण जांचें — दस्ताने/रूई अक्सर कवर नहीं होते",
  },
  {
    id: "room_rent_match",
    label: "Verify room rent charged matches the room category you were in",
    labelHi: "जाँचें कि कमरे का किराया आपकी कमरा श्रेणी के अनुसार है",
  },
  {
    id: "doctor_fees",
    label: "Check doctor visit / surgeon fees are individually listed",
    labelHi: "डॉक्टर विज़िट / सर्जन शुल्क अलग-अलग दर्ज हैं या नहीं",
  },
  {
    id: "duplicate_entries",
    label: "Look for duplicate entries for same medicine/test",
    labelHi: "एक ही दवाई/जाँच के लिए डुप्लिकेट प्रविष्टियाँ देखें",
  },
  {
    id: "non_medical",
    label: "Non-medical charges (telephone, food, laundry) may not be reimbursable",
    labelHi: "गैर-चिकित्सा शुल्क (फोन, खाना, कपड़े धोना) प्रतिपूर्ति योग्य नहीं हो सकते",
  },
  {
    id: "tpa_package",
    label: "If TPA package, confirm package rate vs actual charges",
    labelHi: "यदि TPA पैकेज है, तो पैकेज दर बनाम वास्तविक शुल्क की जाँच करें",
  },
];

/** Generate English bill request letter text */
export function buildEnglishLetter(p: BillLetterParams): string {
  const to = p.tpaName
    ? `The ${p.tpaName} / ${p.hospitalName}`
    : `The Billing Department\n${p.hospitalName}`;

  return `Date: ${p.generatedDate}

To,
${to}

Subject: Request for Itemised Hospital Bill — Patient: ${p.patientName}

Respected Sir/Madam,

I, ${p.patientName}, was admitted to ${p.hospitalName} on ${p.admissionDate} and discharged on ${p.dischargeDate}.${p.policyNumber ? `\nInsurance Policy No.: ${p.policyNumber}` : ""}
KavachSaathi Health ID: ${p.healthId}

I hereby request a complete, itemised bill covering all charges including room rent, doctor/surgeon fees, nursing charges, medicines, consumables, lab investigations, and any other charges levied during my hospitalisation.

This will help me:
1. Reconcile the bill with my insurance coverage.
2. Submit an accurate reimbursement claim to my insurer / TPA.
3. Understand any out-of-pocket expenses clearly.

I would appreciate if the itemised bill is provided at the earliest, ideally before or at the time of discharge, to avoid delays in the claim process.

Thank you for your cooperation.

Yours sincerely,
${p.patientName}
Health ID: ${p.healthId}

---
${BILL_LETTER_DISCLAIMER}`;
}

/** Generate Hindi bill request letter text */
export function buildHindiLetter(p: BillLetterParams): string {
  const to = p.tpaName
    ? `${p.tpaName} / ${p.hospitalName}`
    : `बिलिंग विभाग\n${p.hospitalName}`;

  return `दिनांक: ${p.generatedDate}

सेवा में,
${to}

विषय: मदवार अस्पताल बिल की मांग — मरीज़: ${p.patientName}

महोदय/महोदया,

मैं, ${p.patientName}, ${p.admissionDate} को ${p.hospitalName} में भर्ती हुआ/हुई था/थी और ${p.dischargeDate} को छुट्टी मिली।${p.policyNumber ? `\nबीमा पॉलिसी नं.: ${p.policyNumber}` : ""}
KavachSaathi हेल्थ आईडी: ${p.healthId}

मैं निवेदन करता/करती हूँ कि मेरे इलाज के दौरान लगाए गए सभी शुल्कों का मदवार बिल उपलब्ध कराया जाए — जिसमें कमरे का किराया, डॉक्टर/सर्जन शुल्क, नर्सिंग शुल्क, दवाएं, उपभोग्य सामग्री, जाँचें और अन्य सभी शुल्क शामिल हों।

इससे मुझे:
1. बीमा कवरेज से बिल मिलान करने में मदद मिलेगी।
2. बीमा कंपनी / TPA को सटीक प्रतिपूर्ति दावा प्रस्तुत करने में सुविधा होगी।
3. अपनी जेब से होने वाले खर्च को स्पष्ट रूप से समझने में मदद मिलेगी।

कृपया यह मदवार बिल जल्द से जल्द, अधिमानतः छुट्टी से पहले या उसी समय उपलब्ध कराएं ताकि दावे में देरी न हो।

आपके सहयोग के लिए धन्यवाद।

भवदीय,
${p.patientName}
हेल्थ आईडी: ${p.healthId}

---
यह पत्र केवल सुविधा के लिए तैयार किया गया है और कानूनी सलाह नहीं है।`;
}
