#!/usr/bin/env node
/**
 * Fail build when activation schedule (or enabled gate) is configured
 * without grievance officer env.
 * Does not print secret values.
 */
const enabled = ["1", "true", "yes", "on"].includes(
  String(process.env.ACTIVATION_ENABLED || "")
    .trim()
    .toLowerCase()
);
const opensAt = String(process.env.ACTIVATION_OPENS_AT || "").trim();
const killOff = ["0", "false", "no", "off"].includes(
  String(process.env.ACTIVATION_ENABLED || "")
    .trim()
    .toLowerCase()
);

// Schedule set (and not kill-switched) OR explicit ACTIVATION_ENABLED=true
const requiresGrievance = Boolean(opensAt && !killOff) || enabled;

if (!requiresGrievance) {
  console.log(
    "check-launch-env: activation schedule/kill-switch idle — OK"
  );
  process.exit(0);
}

if (opensAt && Number.isNaN(Date.parse(opensAt))) {
  console.error(
    "check-launch-env: FAIL — ACTIVATION_OPENS_AT is not a valid ISO date"
  );
  process.exit(1);
}

const name = String(process.env.GRIEVANCE_OFFICER_NAME || "").trim();
const email = String(process.env.GRIEVANCE_OFFICER_EMAIL || "").trim();
const missing = [];
if (!name) missing.push("GRIEVANCE_OFFICER_NAME");
if (!email) missing.push("GRIEVANCE_OFFICER_EMAIL");

if (missing.length) {
  console.error(
    "check-launch-env: FAIL — ACTIVATION_OPENS_AT is set (or ACTIVATION_ENABLED=true) but missing: " +
      missing.join(", ")
  );
  process.exit(1);
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("check-launch-env: FAIL — GRIEVANCE_OFFICER_EMAIL looks invalid");
  process.exit(1);
}

console.log("check-launch-env: grievance + activation schedule OK");
process.exit(0);
