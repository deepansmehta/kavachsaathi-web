/**
 * F57 — FHIR R4 Bundle builder (ABDM / NRCeS oriented).
 * Never includes Aadhaar. SNOMED/LOINC only for well-known blood groups.
 */

export type FhirProfileSource = {
  health_id: string;
  full_name: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  abhaId?: string | null;
  blood_group?: string | null;
  allergies?: string[];
  chronic_conditions?: string[];
  medications?: string[];
  emergency_contacts?: { name?: string; phone?: string; relation?: string }[];
  insurance?: {
    private?: {
      insurerName?: string;
      policyNumber?: string;
      memberId?: string;
      tpaName?: string;
    };
    government?: {
      schemeName?: string;
      cardNumber?: string;
    };
  } | null;
  vaultRecords?: { id?: string; title?: string; type?: string; createdAt?: string }[];
};

const BLOOD_GROUP_LOINC: Record<string, { code: string; display: string }> = {
  "A+": { code: "883-9", display: "ABO group [Type] in Blood" },
  "A-": { code: "883-9", display: "ABO group [Type] in Blood" },
  "B+": { code: "883-9", display: "ABO group [Type] in Blood" },
  "B-": { code: "883-9", display: "ABO group [Type] in Blood" },
  "AB+": { code: "883-9", display: "ABO group [Type] in Blood" },
  "AB-": { code: "883-9", display: "ABO group [Type] in Blood" },
  "O+": { code: "883-9", display: "ABO group [Type] in Blood" },
  "O-": { code: "883-9", display: "ABO group [Type] in Blood" },
};

function fhirGender(g?: string | null): string {
  const x = String(g || "").toLowerCase();
  if (x === "m" || x === "male") return "male";
  if (x === "f" || x === "female") return "female";
  if (x === "o" || x === "other") return "other";
  return "unknown";
}

function uuid(): string {
  return `urn:uuid:${cryptoRandom()}`;
}

function cryptoRandom(): string {
  // Node + browser safe-ish id
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function stripAadhaar(obj: unknown): unknown {
  if (obj == null) return obj;
  if (typeof obj === "string") {
    // drop 12-digit Aadhaar-looking sequences
    return obj.replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[REDACTED]");
  }
  if (Array.isArray(obj)) return obj.map(stripAadhaar);
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (/aadhaar|aadhar|uidai/i.test(k)) continue;
      out[k] = stripAadhaar(v);
    }
    return out;
  }
  return obj;
}

export function buildFhirBundle(src: FhirProfileSource): Record<string, unknown> {
  const patientId = uuid();
  const entries: { fullUrl: string; resource: Record<string, unknown> }[] = [];

  const identifiers: Record<string, unknown>[] = [
    {
      system: "https://kavachsaathi.in/health-id",
      value: src.health_id,
    },
  ];
  if (src.abhaId) {
    identifiers.push({
      system: "https://healthid.ndhm.gov.in",
      value: String(src.abhaId),
    });
  }

  const patient: Record<string, unknown> = {
    resourceType: "Patient",
    id: patientId.replace("urn:uuid:", ""),
    meta: {
      profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"],
    },
    identifier: identifiers,
    name: [{ text: src.full_name || "Unknown" }],
    gender: fhirGender(src.gender),
  };
  if (src.dateOfBirth) patient.birthDate = String(src.dateOfBirth).slice(0, 10);
  if (src.phone) {
    patient.telecom = [{ system: "phone", value: String(src.phone) }];
  }
  if (src.address || src.city || src.state || src.pincode) {
    patient.address = [
      {
        text: src.address || undefined,
        city: src.city || undefined,
        state: src.state || undefined,
        postalCode: src.pincode || undefined,
        country: "IN",
      },
    ];
  }
  entries.push({ fullUrl: patientId, resource: patient });

  for (const a of src.allergies || []) {
    if (!String(a).trim()) continue;
    const id = uuid();
    entries.push({
      fullUrl: id,
      resource: {
        resourceType: "AllergyIntolerance",
        id: id.replace("urn:uuid:", ""),
        meta: {
          profile: [
            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/AllergyIntolerance",
          ],
        },
        clinicalStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
              code: "active",
            },
          ],
        },
        code: { text: String(a) },
        patient: { reference: patientId },
      },
    });
  }

  for (const c of src.chronic_conditions || []) {
    if (!String(c).trim()) continue;
    const id = uuid();
    entries.push({
      fullUrl: id,
      resource: {
        resourceType: "Condition",
        id: id.replace("urn:uuid:", ""),
        meta: {
          profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Condition"],
        },
        code: { text: String(c) },
        subject: { reference: patientId },
      },
    });
  }

  for (const m of src.medications || []) {
    if (!String(m).trim()) continue;
    const id = uuid();
    entries.push({
      fullUrl: id,
      resource: {
        resourceType: "MedicationStatement",
        id: id.replace("urn:uuid:", ""),
        status: "active",
        medicationCodeableConcept: { text: String(m) },
        subject: { reference: patientId },
      },
    });
  }

  const bg = String(src.blood_group || "").trim();
  if (bg && bg !== "—") {
    const id = uuid();
    const loinc = BLOOD_GROUP_LOINC[bg.toUpperCase()];
    entries.push({
      fullUrl: id,
      resource: {
        resourceType: "Observation",
        id: id.replace("urn:uuid:", ""),
        status: "final",
        code: loinc
          ? {
              coding: [
                {
                  system: "http://loinc.org",
                  code: loinc.code,
                  display: loinc.display,
                },
              ],
              text: `Blood group ${bg}`,
            }
          : { text: `Blood group ${bg}` },
        subject: { reference: patientId },
        valueString: bg,
      },
    });
  }

  const priv = src.insurance?.private;
  if (priv?.insurerName || priv?.policyNumber || priv?.memberId) {
    const id = uuid();
    entries.push({
      fullUrl: id,
      resource: {
        resourceType: "Coverage",
        id: id.replace("urn:uuid:", ""),
        status: "active",
        beneficiary: { reference: patientId },
        payor: [{ display: priv.insurerName || "Insurer" }],
        subscriberId: priv.memberId || undefined,
        class: priv.policyNumber
          ? [{ type: { text: "policy" }, value: priv.policyNumber }]
          : undefined,
        extension: priv.tpaName
          ? [{ url: "https://kavachsaathi.in/fhir/tpa", valueString: priv.tpaName }]
          : undefined,
      },
    });
  }
  const gov = src.insurance?.government;
  if (gov?.schemeName || gov?.cardNumber) {
    const id = uuid();
    entries.push({
      fullUrl: id,
      resource: {
        resourceType: "Coverage",
        id: id.replace("urn:uuid:", ""),
        status: "active",
        type: { text: "public" },
        beneficiary: { reference: patientId },
        payor: [{ display: gov.schemeName || "Government scheme" }],
        subscriberId: gov.cardNumber || undefined,
      },
    });
  }

  for (const ec of src.emergency_contacts || []) {
    if (!ec?.name && !ec?.phone) continue;
    const id = uuid();
    entries.push({
      fullUrl: id,
      resource: {
        resourceType: "RelatedPerson",
        id: id.replace("urn:uuid:", ""),
        patient: { reference: patientId },
        name: ec.name ? [{ text: ec.name }] : undefined,
        telecom: ec.phone ? [{ system: "phone", value: ec.phone }] : undefined,
        relationship: ec.relation
          ? [{ text: ec.relation }]
          : [{ text: "emergency contact" }],
      },
    });
  }

  for (const v of src.vaultRecords || []) {
    const id = uuid();
    entries.push({
      fullUrl: id,
      resource: {
        resourceType: "DocumentReference",
        id: id.replace("urn:uuid:", ""),
        status: "current",
        type: { text: v.type || "clinical-document" },
        description: v.title || "Vault record",
        subject: { reference: patientId },
        date: v.createdAt || undefined,
        content: [
          {
            attachment: {
              title: v.title || "metadata-only",
              contentType: "text/plain",
              // metadata only — no file contents
              data: undefined,
            },
          },
        ],
      },
    });
  }

  const compositionId = uuid();
  entries.unshift({
    fullUrl: compositionId,
    resource: {
      resourceType: "Composition",
      id: compositionId.replace("urn:uuid:", ""),
      status: "final",
      type: { text: "KavachSaathi health record export" },
      subject: { reference: patientId },
      date: new Date().toISOString(),
      title: "KavachSaathi FHIR Export",
      author: [{ display: "KavachSaathi" }],
      section: [
        {
          title: "Patient health summary",
          entry: entries
            .filter((e) => e.resource.resourceType !== "Composition")
            .map((e) => ({ reference: e.fullUrl })),
        },
      ],
    },
  });

  const bundle = {
    resourceType: "Bundle",
    type: "document",
    timestamp: new Date().toISOString(),
    meta: {
      tag: [
        {
          system: "https://kavachsaathi.in/fhir",
          code: "abdm-ready-export",
          display: "ABDM-oriented FHIR R4 export (not a live HIP/HIU submission)",
        },
      ],
    },
    entry: entries,
  };

  return stripAadhaar(bundle) as Record<string, unknown>;
}

/** Build a standalone FHIR Patient resource for Scan & Register export. */
export function buildFhirPatientResource(
  src: FhirProfileSource
): Record<string, unknown> {
  const bundle = buildFhirBundle(src);
  const entries = (bundle.entry || []) as { resource: Record<string, unknown> }[];
  const patient = entries.find((e) => e.resource?.resourceType === "Patient");
  return (patient?.resource || {
    resourceType: "Patient",
    name: [{ text: src.full_name }],
  }) as Record<string, unknown>;
}

export type FhirValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/** Offline structural FHIR R4 Bundle validation (no network). */
export function validateFhirBundle(bundle: unknown): FhirValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!bundle || typeof bundle !== "object") {
    return { valid: false, errors: ["Bundle is not an object"], warnings };
  }
  const b = bundle as Record<string, unknown>;
  if (b.resourceType !== "Bundle") errors.push("resourceType must be Bundle");
  if (b.type !== "document" && b.type !== "collection") {
    errors.push("Bundle.type must be document or collection");
  }
  if (!Array.isArray(b.entry) || b.entry.length === 0) {
    errors.push("Bundle.entry must be a non-empty array");
  } else {
    let hasPatient = false;
    for (const e of b.entry as Record<string, unknown>[]) {
      const r = e.resource as Record<string, unknown> | undefined;
      if (!r?.resourceType) errors.push("entry missing resource.resourceType");
      if (r?.resourceType === "Patient") hasPatient = true;
      const json = JSON.stringify(r || {});
      if (/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(json) || /aadhaar/i.test(json)) {
        errors.push("Aadhaar-like data must not appear in FHIR export");
      }
    }
    if (!hasPatient) errors.push("Bundle must include a Patient resource");
  }
  if (!b.timestamp) warnings.push("Bundle.timestamp missing");
  return { valid: errors.length === 0, errors, warnings };
}
