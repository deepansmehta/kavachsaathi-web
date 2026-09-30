/**
 * Live GET check for all 100 QR urls (read-only, no activation).
 * 300ms delay; backoff on 429.
 */
import * as fs from "fs";
import * as path from "path";

const qrPath = path.join(process.cwd(), "exports", "qr-urls.csv");
const DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!fs.existsSync(qrPath)) {
    console.error("FAIL: exports/qr-urls.csv missing — run export first");
    process.exit(1);
  }
  const lines = fs
    .readFileSync(qrPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1);
  const rows = lines
    .map((l) => {
      const [health_id, url] = l.split(",");
      return { health_id: health_id?.trim(), url: url?.trim() };
    })
    .filter((r) => r.health_id && r.url);

  console.log(`checking_urls: ${rows.length}`);
  const okList: string[] = [];
  const failList: { health_id: string; reason: string }[] = [];

  for (const row of rows) {
    let attempt = 0;
    let done = false;
    while (!done && attempt < 4) {
      attempt += 1;
      try {
        const res = await fetch(row.url!, {
          headers: { "Cache-Control": "no-cache" },
          redirect: "follow",
        });
        if (res.status === 429) {
          const wait = 2000 * attempt;
          await sleep(wait);
          continue;
        }
        const html = await res.text();
        const hasForm =
          /Activate your card/i.test(html) ||
          /Secret activation/i.test(html) ||
          /activation code/i.test(html);
        const invalid = /not a valid KavachSaathi card/i.test(html);
        const errorish =
          /Service temporarily unavailable/i.test(html) ||
          /Too many requests/i.test(html);
        if (res.status === 200 && hasForm && !invalid && !errorish) {
          okList.push(row.health_id!);
        } else {
          failList.push({
            health_id: row.health_id!,
            reason: `http=${res.status} form=${hasForm} invalid=${invalid}`,
          });
        }
        done = true;
      } catch (e) {
        if (attempt >= 4) {
          failList.push({
            health_id: row.health_id!,
            reason: e instanceof Error ? e.message : "fetch error",
          });
          done = true;
        } else {
          await sleep(1000 * attempt);
        }
      }
    }
    await sleep(DELAY_MS);
  }

  console.log("--- LIVE URL SUMMARY ---");
  console.log(`total: ${rows.length}`);
  console.log(`OK: ${okList.length}`);
  console.log(`FAIL: ${failList.length}`);
  if (failList.length) {
    console.log("failing_health_ids:");
    for (const f of failList) {
      console.log(`  - ${f.health_id} (${f.reason})`);
    }
  }
  process.exit(failList.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
