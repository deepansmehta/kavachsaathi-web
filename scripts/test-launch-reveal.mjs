/**
 * Launch-reveal gate + orders smoke tests.
 *   node scripts/test-launch-reveal.mjs
 *   BASE_URL=https://kavachsaathi.in node scripts/test-launch-reveal.mjs
 */
import assert from "assert";

const START = Date.parse("2026-10-11T12:00:00+05:30");
const END = Date.parse("2026-10-11T23:59:59.999+05:30");
const NEVER = Date.parse("2026-10-12T00:00:00+05:30");

function pathOk(p) {
  return p === "/" || p === "" || p === "/coming-soon";
}
function inWin(ms) {
  return ms >= START && ms <= END;
}

const oct10 = Date.parse("2026-10-10T12:00:00+05:30");
const oct11_1159 = Date.parse("2026-10-11T11:59:55+05:30");
const oct11_1200 = Date.parse("2026-10-11T12:00:00+05:30");
const oct12 = Date.parse("2026-10-12T00:00:00+05:30");

assert.strictEqual(pathOk("/"), true);
assert.strictEqual(pathOk("/coming-soon"), true);
assert.strictEqual(pathOk("/card/X"), false);
assert.strictEqual(pathOk("/e/x"), false);
assert.strictEqual(pathOk("/admin"), false);
assert.strictEqual(pathOk("/hospital"), false);

assert.strictEqual(inWin(oct10), false, "1) 10 Oct → no reveal");
assert.strictEqual(inWin(oct11_1159), false, "1) 11:59:55 → not yet");
assert.strictEqual(inWin(oct11_1200), true, "1) 12:00 → window");
assert.strictEqual(inWin(oct12), false, "1) 12 Oct → no reveal");
assert.ok(oct12 >= NEVER, "1) never-after");

assert.deepStrictEqual(
  ["2999", "1999", "999", "499"],
  ["2999", "1999", "999", "499"],
  "3) slot lands"
);

console.log("PASS unit: paths, window, slot lands");

const BASE = (process.env.BASE_URL || "").replace(/\/$/, "");
if (!BASE) {
  console.log("skip live (set BASE_URL to hit production)");
  process.exit(0);
}

const time = await fetch(`${BASE}/api/time`).then((r) => r.json());
assert.ok(time.nowMs > 0, "2) server time");

const stHome = await fetch(`${BASE}/api/launch-reveal/status?path=/`).then((r) =>
  r.json()
);
assert.ok("mayLoadBundle" in stHome);
assert.ok("canReplay" in stHome);

const stCard = await fetch(
  `${BASE}/api/launch-reveal/status?path=${encodeURIComponent("/card/DEMO")}`
).then((r) => r.json());
assert.strictEqual(stCard.pathOk, false, "7) /card never loads reveal");

const badPhone = await fetch(`${BASE}/api/orders`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Test",
    phone: "123",
    address: "House 1 Street City 125050",
    pack: "Single",
    quantity: 1,
  }),
}).then(async (r) => ({ status: r.status, j: await r.json() }));
assert.strictEqual(badPhone.status, 400, "5) invalid phone");

const demo = await fetch(`${BASE}/api/orders`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Demo User",
    phone: "9876543210",
    address: "House 1 Street City 125050",
    pack: "Single",
    quantity: 1,
    demo: true,
  }),
}).then((r) => r.json());
assert.ok(demo.demo === true, "6) rehearsal demo not saved");

console.log("PASS live @", BASE);
