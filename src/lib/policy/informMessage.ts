import { maskPolicyNumber } from "./status";

/** Pre-written message for Inform Insurer — no SMS API; user shares from their phone. */
export function buildInformInsurerMessage(opts: {
  holderName: string;
  cardId: string;
  insurerName: string;
  policyNumberLast4: string | null;
  hospitalName: string;
  date: string;
}): string {
  const masked = maskPolicyNumber(opts.policyNumberLast4);
  const hospital = opts.hospitalName.trim() || "[hospital name]";
  const date = opts.date.trim() || new Date().toISOString().slice(0, 10);
  return [
    `Emergency intimations — KavachSaathi cardholder`,
    `Name: ${opts.holderName}`,
    `Card ID: ${opts.cardId}`,
    `Insurer: ${opts.insurerName}`,
    `Policy (masked): ${masked}`,
    `Hospital: ${hospital}`,
    `Date: ${date}`,
    ``,
    `Please guide for cashless / claim intimation.`,
    `(Sent by cardholder via their own phone. KavachSaathi does not sell insurance.)`,
  ].join("\n");
}
