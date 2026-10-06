/** Live Pack2 smoke on demo — delete nothing from real inventory */
import { resetDemoCard } from "./reset-demo-card";
import { getAdminDb } from "../src/lib/firebase-admin";
import { DEMO_ACTIVATION_CODE, DEMO_HEALTH_ID } from "./demoConstants";

const BASE = "https://kavachsaathi.in";

async function main() {
  const db = getAdminDb();
  await resetDemoCard(db);
  console.log("demo reset start");

  const act = await fetch(`${BASE}/api/card/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      health_id: DEMO_HEALTH_ID,
      activation_code: DEMO_ACTIVATION_CODE,
      pin: "4242",
      full_name: "Demo User",
      phone: "9876543210",
      blood_group: "O+",
      city: "Delhi",
      allergies: ["Peanuts"],
      chronic_conditions: [],
      medications: [],
      emergency_contacts: [
        { name: "Family", phone: "9876543211", relation: "Spouse" },
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
  console.log("activate", act.status, (await act.text()).slice(0, 140));

  const nb = await fetch(`${BASE}/api/need-blood`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      health_id: DEMO_HEALTH_ID,
      hospital: "City Hospital Delhi",
    }),
  });
  const nj = (await nb.json()) as {
    message?: string;
    eRaktKoshUrl?: string;
    whatsappUrl?: string;
    error?: string;
  };
  console.log(
    "need-blood",
    nb.status,
    nj.message?.slice(0, 100),
    nj.eRaktKoshUrl,
    !!nj.whatsappUrl,
    nj.error || ""
  );

  const html = await (await fetch(`${BASE}/card/${DEMO_HEALTH_ID}`)).text();
  console.log(
    "emergency_need_blood_ui",
    /Need .*blood|share request/i.test(html)
  );
  console.log("no_pack2_leaks", {
    coverage: html.includes("Your Coverage"),
    discharge: html.includes("Discharge checklist"),
    docpack: html.includes("Document pack"),
  });

  const schemes = await (await fetch(`${BASE}/schemes`)).text();
  console.log(
    "schemes_ok",
    /PM-JAY|पीएम/.test(schemes) && /Verify on the official portal|आधिकारिक/.test(schemes)
  );

  // Attendant pass create requires session — skip UI; unit tested

  await resetDemoCard(db);
  console.log("demo reset done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
