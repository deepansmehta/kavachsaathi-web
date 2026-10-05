/**
 * seed-insurers.ts
 * Seeds Firestore config/insurers with Indian insurer helplines.
 * ONLY numbers verified from each insurer's official website (sourceUrl required).
 *
 * Run (DO NOT run against production until user approves the list):
 *   ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/seed-insurers.ts
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

/**
 * Verified helplines only — leave out any number not confirmed on the official page.
 * HDFC ERGO: seed previously had 1800-266-0700 — NOT found on official customer-care page; omitted.
 * United India: seed previously had 1800-425-4242 — official site lists 1800-425-33333; omitted until re-confirmed.
 */
const INSURERS = [
  {
    name: "Star Health and Allied Insurance",
    tpaHelpline: "1800-425-2255",
    claimsHelpline: "1800-425-2255",
    email: "support@starhealth.in",
    website: "https://www.starhealth.in",
    sourceUrl: "https://www.starhealth.in/contact/",
  },
  {
    name: "Niva Bupa Health Insurance (formerly Max Bupa)",
    tpaHelpline: "1860-500-8888",
    claimsHelpline: "1860-500-8888",
    email: "customercare@nivabupa.com",
    website: "https://www.nivabupa.com",
    sourceUrl: "https://www.nivabupa.com/help-centre/help-faq.html",
  },
  {
    name: "Bajaj Allianz General Insurance",
    tpaHelpline: "1800-209-5858",
    claimsHelpline: "1800-209-5858",
    email: "bagichelp@bajajallianz.co.in",
    website: "https://www.bajajallianz.com",
    sourceUrl: "https://www.bajajgeneralinsurance.com/about-us/customer-service.html",
  },
  {
    name: "Tata AIG General Insurance",
    tpaHelpline: "1800-266-7780",
    claimsHelpline: "1800-266-7780",
    email: "customersupport@tataaig.com",
    website: "https://www.tataaig.com",
    sourceUrl: "https://www.tataaig.com/faqs-on-insurance",
  },
  {
    name: "ICICI Lombard General Insurance",
    tpaHelpline: "1800-2666",
    claimsHelpline: "1800-2666",
    email: "customersupport@icicilombard.com",
    website: "https://www.icicilombard.com",
    sourceUrl: "https://www.icicilombard.com/customer-support",
  },
  {
    name: "New India Assurance",
    tpaHelpline: "1800-209-1415",
    claimsHelpline: "1800-209-1415",
    email: "ho@newindia.co.in",
    website: "https://www.newindia.co.in",
    sourceUrl: "https://www.newindia.co.in/contact-us",
  },
  {
    name: "National Insurance Company",
    tpaHelpline: "1800-345-0330",
    claimsHelpline: "1800-345-0330",
    email: "customer.support@nic.co.in",
    website: "https://nationalinsurance.nic.co.in",
    sourceUrl: "https://nationalinsurance.nic.co.in/en/contacts-us",
  },
];

async function main() {
  if (process.env.SEED_INSURERS_CONFIRM !== "YES") {
    console.log("Insurer list (verified only) — NOT seeding yet.\n");
    console.log(
      "| Insurer | Helpline | Source URL |\n|---------|----------|------------|"
    );
    for (const i of INSURERS) {
      console.log(`| ${i.name} | ${i.tpaHelpline} | ${i.sourceUrl} |`);
    }
    console.log(
      "\nOmitted (unverified / mismatched):\n" +
        "- HDFC ERGO (previous 1800-266-0700 not on official customer-care page)\n" +
        "- United India (previous 1800-425-4242; official lists 1800-425-33333)\n"
    );
    console.log(
      "To seed production/Firestore, re-run with SEED_INSURERS_CONFIRM=YES"
    );
    process.exit(0);
  }

  const saPath = path.join(process.cwd(), "service-account.json");
  if (!fs.existsSync(saPath)) {
    console.error("service-account.json not found");
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert(JSON.parse(fs.readFileSync(saPath, "utf8"))),
    });
  }

  const db = getFirestore();
  await db.collection("config").doc("insurers").set(
    {
      list: INSURERS,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  console.log(`✅ Seeded ${INSURERS.length} insurers to config/insurers`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
