/** Pack 4 live smoke: activate demo, check auto summary, disposable hospital cleanup, reset. */
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../src/lib/firebase-admin";
import { DEMO_ACTIVATION_CODE, DEMO_HEALTH_ID } from "./demoConstants";
import { resetDemoCard } from "./reset-demo-card";
import { hashConsentCode } from "../src/lib/hospitalConsent";

const BASE = "https://kavachsaathi.in";

async function main() {
  const db = getAdminDb();
  await resetDemoCard(db);

  const act = await fetch(`${BASE}/api/card/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      health_id: DEMO_HEALTH_ID,
      activation_code: DEMO_ACTIVATION_CODE,
      pin: "4242",
      full_name: "Demo Pack4 User",
      phone: "9876543210",
      blood_group: "B+",
      city: "Gurugram",
      gender: "male",
      dateOfBirth: "1960-05-01",
      allergies: ["penicillin"],
      chronic_conditions: ["Diabetes"],
      medications: ["metformin", "warfarin"],
      criticalFlags: { tags: ["Pacemaker present"] },
      emergency_contacts: [
        { name: "Ravi", phone: "9876543211", relation: "son" },
      ],
      organDonor: "yes",
      consents: {
        dataAccurate: true,
        privacyAccepted: true,
        termsAccepted: true,
      },
      requireFullDocs: false,
    }),
  });
  console.log("activate", act.status, (await act.text()).slice(0, 200));

  const html = await (await fetch(`${BASE}/card/${DEMO_HEALTH_ID}`)).text();
  console.log("auto_summary_ui", /Auto summary/i.test(html));
  console.log("has_Bplus", html.includes("B+"));
  console.log("no_aadhaar_public", !/aadhaar/i.test(html));

  const fhir = await fetch(`${BASE}/api/profile/fhir-export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: "4242" }),
  });
  console.log("fhir_no_session", fhir.status);

  const staffEmail = `pack4-test-${Date.now()}@example.com`;
  const hospRef = await db.collection("hospitals").add({
    name: "Pack4 Disposable Test Hospital",
    type: "private",
    city: "TestCity",
    staffEmails: [staffEmail],
    verified: true,
    scanRegisterCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    disposable: true,
    pack4: true,
  });
  const unv = await db.collection("hospitals").add({
    name: "Pack4 Unverified",
    type: "private",
    city: "X",
    staffEmails: [`unv-${Date.now()}@example.com`],
    verified: false,
    disposable: true,
    pack4: true,
  });
  console.log("hospitals", hospRef.id, unv.id);

  const sr = await fetch(`${BASE}/api/hospital/scan-register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ healthId: DEMO_HEALTH_ID, consent: "none" }),
  });
  console.log("scan_register_no_session", sr.status);

  const card = await db.collection("cards").doc(DEMO_HEALTH_ID).get();
  const profileId = String(card.data()?.linkedProfileId || "");
  await db.collection("hospitalConsentCodes").doc(DEMO_HEALTH_ID).set({
    healthId: DEMO_HEALTH_ID,
    profileId,
    codeHash: hashConsentCode("123456", DEMO_HEALTH_ID),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    used: false,
  });

  await hospRef.delete();
  await unv.delete();
  await db
    .collection("hospitalConsentCodes")
    .doc(DEMO_HEALTH_ID)
    .delete()
    .catch(() => {});
  console.log("disposable_hospitals_deleted");

  await resetDemoCard(db);
  console.log("demo_reset_final");

  const realQ = await db
    .collection("cards")
    .where("health_id", ">=", "KVS-2026-")
    .where("health_id", "<", "KVS-2027-")
    .limit(5)
    .get();
  let activatedReal = 0;
  for (const d of realQ.docs) {
    if (d.data().status === "activated") activatedReal++;
  }
  console.log("sample_real_activated_in_5", activatedReal);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
