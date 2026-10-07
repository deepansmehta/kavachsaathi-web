/**
 * F16 — Document Pack PDF
 * Section keys, Aadhaar masking, and in-memory rate limit (10/hr per profileId).
 */

export const DOCUMENT_PACK_SECTIONS = [
  "personal_details",
  "emergency_contacts",
  "medical_history",
  "insurance_details",
  "medications",
  "allergies",
  "donor_directive",
  "coverage_snapshot",
] as const;
export type DocumentPackSection = (typeof DOCUMENT_PACK_SECTIONS)[number];


export const SECTION_LABELS: Record<DocumentPackSection, string> = {
  personal_details: "Personal Details",
  emergency_contacts: "Emergency Contacts",
  medical_history: "Medical History",
  insurance_details: "Insurance Details",
  medications: "Current Medications",
  allergies: "Allergies & Sensitivities",
  donor_directive: "Donor / Living Directive",
  coverage_snapshot: "Insurance Coverage Snapshot",
};

export const SECTION_LABELS_HI: Record<DocumentPackSection, string> = {
  personal_details: "व्यक्तिगत विवरण",
  emergency_contacts: "आपातकालीन संपर्क",
  medical_history: "चिकित्सा इतिहास",
  insurance_details: "बीमा विवरण",
  medications: "वर्तमान दवाएं",
  allergies: "एलर्जी और संवेदनशीलताएं",
  donor_directive: "दाता / निर्देश",
  coverage_snapshot: "बीमा कवरेज सारांश",
};

/** Mask Aadhaar number — show only last 4 digits: XXXX-XXXX-1234 */
export function maskAadhaar(aadhaar: string | null | undefined): string {
  if (!aadhaar) return "";
  const digits = String(aadhaar).replace(/\D/g, "");
  if (digits.length < 4) return "XXXX-XXXX-XXXX";
  const last4 = digits.slice(-4);
  return `XXXX-XXXX-${last4}`; 
}

/** In-memory rate limit: 10 requests per hour per profileId */
type RateBucket = { count: number; resetAt: number };
const rateLimitMap = new Map<string, RateBucket>();

export const DOC_PACK_RATE_LIMIT = 10;
export const DOC_PACK_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export type RateLimitCheck = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function checkDocPackRateLimit(profileId: string): RateLimitCheck {
  const now = Date.now();
  let bucket = rateLimitMap.get(profileId);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + DOC_PACK_WINDOW_MS };
    rateLimitMap.set(profileId, bucket);
  }
  if (bucket.count >= DOC_PACK_RATE_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: bucket.resetAt - now,
    };
  }
  bucket.count += 1;
  return {
    allowed: true,
    remaining: DOC_PACK_RATE_LIMIT - bucket.count,
    retryAfterMs: 0,
  };                   
}

/** Validate section list from request body */
export function validateSections(sections: unknown): DocumentPackSection[] | null {
  if (!Array.isArray(sections) || sections.length === 0) return null;
  const valid: DocumentPackSection[] = [];
  for (const s of sections) {
    if (DOCUMENT_PACK_SECTIONS.includes(s as DocumentPackSection)) {
      valid.push(s as DocumentPackSection);
    }
  }
  return valid.length > 0 ? valid : null;
}
