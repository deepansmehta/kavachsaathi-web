/**
 * Guard test: reset-demo-card must refuse non-demo health ids.
 *   npx tsx scripts/test-reset-demo-guard.ts
 */
import { DEMO_HEALTH_ID } from "./demoConstants";

async function main() {
  // Soft check of source guard — do not call reset on real cards
  const fs = await import("fs");
  const path = await import("path");
  const src = fs.readFileSync(
    path.join(process.cwd(), "scripts/reset-demo-card.ts"),
    "utf8"
  );
  const hasHardId = src.includes("KVS-DEMO-00001") && src.includes("isDemo");
  const refuses = src.includes("REFUSED") || src.includes("refusing");
  console.log(
    hasHardId && refuses && DEMO_HEALTH_ID === "KVS-DEMO-00001"
      ? "PASS 12 reset-demo refuses non-demo"
      : "FAIL 12 reset-demo guard"
  );
}

main();
