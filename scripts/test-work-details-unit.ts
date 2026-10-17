/**
 * Offline unit checks for workDetails encode / public scrub / consent.
 * Requires PROFILE_ENC_KEY in env (same as production — never printed).
 */
import {
  encodeWorkDetailsForStorage,
  toPublicWorkDetails,
  validateWorkDetailsInput,
  decodeWorkDetailsForEdit,
  telLinkWork,
} from "../src/lib/workDetails";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const sample = {
  workType: "job" as const,
  organisationName: "Acme",
  city: "Pune",
  designation: "Tech",
  employerContactName: "HR Person",
  employerContactPhone: "9876512345",
  employerContactRole: "HR" as const,
  employerContactConsent: true,
  employeeId: "E1",
  esicNumber: "S1",
  companyInsurer: "InsCo",
  companyPolicyNo: "P1",
  visibility: {
    organisationName: true,
    city: true,
    employerContact: true,
    designation: false,
  },
};

assert(
  validateWorkDetailsInput({
    ...sample,
    employerContactConsent: false,
  }) !== null,
  "consent required"
);

const stored = encodeWorkDetailsForStorage(sample);
assert(!!stored, "stored");
assert(!!stored!.employeeIdEnc, "employee encrypted");
assert(!!stored!.esicNumberEnc, "esic encrypted");
assert(!!stored!.companyPolicyNoEnc, "policy encrypted");
assert(!(stored as { employeeId?: string }).employeeId, "no plain employeeId");

const pub = toPublicWorkDetails(stored);
assert(pub?.organisationName === "Acme", "org public");
assert(pub?.city === "Pune", "city public");
assert(!pub?.designation, "designation off");
assert(pub?.employerContactPhone === "9876512345", "phone public when on");
assert(telLinkWork(pub!.employerContactPhone) === "tel:+919876512345", "tel");

const json = JSON.stringify(pub);
assert(!/E1|S1|P1|InsCo|employeeId|esic|policy/i.test(json), "pin-only scrubbed from public JSON");

const off = toPublicWorkDetails({
  ...stored!,
  visibility: {
    organisationName: false,
    city: false,
    employerContact: false,
    designation: false,
  },
});
assert(off === null, "toggles off → null public block");

const edit = decodeWorkDetailsForEdit(stored);
assert(edit?.employeeId === "E1", "decode employee");
assert(edit?.esicNumber === "S1", "decode esic");

console.log("OK test-work-details-unit");
