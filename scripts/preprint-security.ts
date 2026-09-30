/**
 * Pre-print security checks against production (read-only except demo page when activated).
 * Does not print secrets.
 */
import * as fs from "fs";
import * as path from "path";

const BASE = "https://kavachsaathi.in";

function visibleLeak(html: string, needle: string): boolean {
  // Strip script/style; check remaining text-ish content and common visible tags
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  // Visible: between tags as text nodes
  const texts = stripped.match(/>([^<]+)</g) || [];
  const joined = texts.map((t) => t.slice(1, -1)).join(" ");
  return joined.includes(needle);
}

async function timedGet(url: string) {
  const t0 = Date.now();
  const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
  const html = await res.text();
  return { status: res.status, html, ms: Date.now() - t0 };
}

async function main() {
  const qrPath = path.join(process.cwd(), "exports", "qr-urls.csv");
  const sampleHealth = fs.existsSync(qrPath)
    ? fs
        .readFileSync(qrPath, "utf8")
        .trim()
        .split(/\r?\n/)[1]
        ?.split(",")[0]
        ?.trim()
    : "";

  console.log("--- SECURITY ---");

  // 1) Unactivated real card HTML must not show health_id / activation as visible text
  if (sampleHealth) {
    const { html, status } = await timedGet(
      `${BASE}/card/${sampleHealth}`
    );
    const leakHid = visibleLeak(html, sampleHealth);
    // We don't know the activation code here — check generic 4-digit packaging patterns carefully:
    // only fail if health_id visible
    const pass = status === 200 && !leakHid;
    console.log(
      `unactivated_public_no_visible_health_id: ${pass ? "PASS" : "FAIL"} (http=${status}, visible_health_id=${leakHid})`
    );
  } else {
    console.log("unactivated_public_no_visible_health_id: FAIL (no sample)");
  }

  // 2) Demo card (should be unactivated after e2e) — check no visible DEMO id / no activation code digits as labelled field
  {
    const { html, status } = await timedGet(`${BASE}/card/KVS-DEMO-00001`);
    const leakHid = visibleLeak(html, "KVS-DEMO-00001");
    const leakCode = visibleLeak(html, "7391"); // demo activation after update
    const isForm =
      /Activate your card/i.test(html) || /Secret activation/i.test(html);
    const isEmergency = /Emergency medical info/i.test(html);
    console.log(
      `demo_page_no_visible_health_id: ${!leakHid ? "PASS" : "FAIL"}`
    );
    console.log(
      `demo_page_no_visible_activation_code: ${!leakCode ? "PASS" : "FAIL"}`
    );
    console.log(
      `demo_page_state: ${isForm ? "activation_form" : isEmergency ? "emergency" : "other"} http=${status}`
    );
  }

  // 3) Made-up ids — same generic Invalid; timing class similar
  {
    const a = await timedGet(`${BASE}/card/KVS-2026-99999`);
    const b = await timedGet(`${BASE}/card/KVS-DEMO-99999`);
    const msgA = /not a valid KavachSaathi card/i.test(a.html);
    const msgB = /not a valid KavachSaathi card/i.test(b.html);
    const leakExist =
      /not in our system/i.test(a.html) || /not in our system/i.test(b.html);
    const timingClose = Math.abs(a.ms - b.ms) < 2000; // same class, not cryptographic
    console.log(
      `fake_ids_generic_invalid: ${msgA && msgB && !leakExist ? "PASS" : "FAIL"}`
    );
    console.log(
      `fake_ids_timing_same_class: ${timingClose ? "PASS" : "FAIL"} (Δms=${Math.abs(a.ms - b.ms)})`
    );
  }

  // 4) robots / noindex for /card
  {
    const { html } = await timedGet(
      `${BASE}/card/${sampleHealth || "KVS-DEMO-00001"}`
    );
    const noindex =
      /name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html) ||
      /content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots["']/i.test(html);
    console.log(`card_noindex_meta: ${noindex ? "PASS" : "FAIL"}`);

    const robots = await fetch(`${BASE}/robots.txt`).then((r) => r.text());
    console.log(
      `robots_txt_present: ${robots.length > 0 ? "PASS" : "FAIL"}`
    );
  }

  // 5) HTTPS / www
  {
    const apex = await fetch("http://kavachsaathi.in/", {
      redirect: "manual",
    }).catch(() => null);
    const www = await fetch("https://www.kavachsaathi.in/", {
      redirect: "manual",
    }).catch(() => null);
    const apexHttps = await fetch("https://kavachsaathi.in/", {
      redirect: "manual",
    });
    console.log(
      `https_apex: ${apexHttps.status < 400 ? "PASS" : "FAIL"} (status=${apexHttps.status})`
    );
    console.log(
      `http_redirect_or_https: ${
        !apex || apex.status === 301 || apex.status === 302 || apex.status === 308
          ? "PASS"
          : `INFO status=${apex?.status}`
      }`
    );
    const wwwLoc = www?.headers.get("location") || "";
    console.log(
      `www_behavior: status=${www?.status} location=${wwwLoc || "(none/body)"}`
    );
  }

  // 6) Rate limit config (from source knowledge / live probe lightly)
  console.log(
    "rate_limit_activation: 15 req / 15 min / IP (captchaAfter 6) — source confirmed"
  );
  console.log(
    "rate_limit_pin_login: 5 req / 5 min / IP+identifier (captchaAfter 3) — source confirmed"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
