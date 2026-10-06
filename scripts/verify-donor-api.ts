import { resetDemoCard } from "./reset-demo-card";
import { getAdminDb } from "../src/lib/firebase-admin";

async function main() {
  const db = getAdminDb();
  await resetDemoCard(db);
  const res = await fetch("https://kavachsaathi.in/api/card/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      health_id: "KVS-DEMO-00001",
      activation_code: "7391",
      pin: "4242",
      full_name: "Demo User",
      phone: "9876543210",
      blood_group: "O+",
      city: "Delhi",
      allergies: ["Peanuts"],
      chronic_conditions: [],
      medications: [],
      emergency_contacts: [
        { name: "Family", phone: "9876543210", relation: "Spouse" },
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
  const body = await res.json();
  console.log("activate", res.status, JSON.stringify(body).slice(0, 400));

  const unlock = await fetch("https://kavachsaathi.in/api/full-details", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "pin",
      health_id: "KVS-DEMO-00001",
      pin: "4242",
    }),
  });
  const unlockText = await unlock.text();
  console.log("unlock", unlock.status, unlockText.slice(0, 400));
  const setCookie = unlock.headers.getSetCookie
    ? unlock.headers.getSetCookie()
    : [];
  const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");
  console.log("cookies", setCookie.length, cookieHeader ? "yes" : "no");

  const view = await fetch("https://kavachsaathi.in/api/full-details", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  const payload = (await view.json()) as Record<string, unknown>;
  console.log("view", view.status);
  console.log("scope", payload.scope);
  console.log("donorDirective", JSON.stringify(payload.donorDirective));
  // Disclaimer is UI-only; confirm API includes donor payload when flag ON
  console.log(
    "api_donor_ok",
    payload.donorDirective !== undefined && payload.scope === "pin"
  );

  await resetDemoCard(db);
  console.log("reset");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
