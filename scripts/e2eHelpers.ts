/** Minimal public-profile mapper for e2e (mirrors cardsRepo scrub). */
export function mapPublicForTest(data: Record<string, unknown>) {
  const insurance = data.insurance as
    | {
        private?: { insurerName?: string; policyNumberEnc?: string };
        government?: { schemeName?: string };
      }
    | undefined;
  return {
    name: String(data.full_name || ""),
    blood_group: String(data.blood_group || ""),
    city: String(data.city || ""),
    insurerName: insurance?.private?.insurerName || null,
    schemeName: insurance?.government?.schemeName || null,
    // intentionally omit idProofs, addressEnc, policy numbers
  };
}
