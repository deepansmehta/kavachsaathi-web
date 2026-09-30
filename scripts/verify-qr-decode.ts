/**
 * Decode every PNG in exports/qr-print/ and compare to exports/qr-urls.csv.
 * Uses jsqr + pngjs installed with --no-save (not written to package.json).
 *
 *   npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/verify-qr-decode.ts
 */
import * as fs from "fs";
import * as path from "path";
import { PNG } from "pngjs";
import jsQR from "jsqr";

const ROOT = process.cwd();
const CSV = path.join(ROOT, "exports", "qr-urls.csv");
const DIR = path.join(ROOT, "exports", "qr-print");

type Row = { health_id: string; url: string };

function loadCsv(): Row[] {
  return fs
    .readFileSync(CSV, "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [health_id, url] = line.split(",").map((s) => s.trim());
      return { health_id, url };
    });
}

function decodePng(file: string): string | null {
  const buf = fs.readFileSync(file);
  const png = PNG.sync.read(buf);
  const code = jsQR(
    new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength),
    png.width,
    png.height,
    { inversionAttempts: "dontInvert" }
  );
  return code?.data || null;
}

async function lightLiveCheck(ids: string[], byId: Map<string, string>) {
  console.log("--- LIGHT LIVE GET (5 random) ---");
  for (const id of ids) {
    const url = byId.get(id)!;
    const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
    const html = await res.text();
    const form =
      /Activate your card/i.test(html) || /Secret activation/i.test(html);
    const invalid = /not a valid KavachSaathi card/i.test(html);
    const ok = res.status === 200 && form && !invalid;
    console.log(`  ${id}: ${ok ? "OK" : "FAIL"} http=${res.status}`);
  }
}

async function main() {
  const rows = loadCsv();
  const byId = new Map(rows.map((r) => [r.health_id, r.url]));
  let ok = 0;
  const mismatches: string[] = [];

  for (const r of rows) {
    const png = path.join(DIR, `${r.health_id}.png`);
    if (!fs.existsSync(png)) {
      mismatches.push(r.health_id);
      continue;
    }
    const decoded = decodePng(png);
    if (decoded === r.url) ok += 1;
    else mismatches.push(r.health_id);
  }

  console.log("--- DECODE VERIFICATION ---");
  console.log(`total: ${rows.length}`);
  console.log(`decoded_OK: ${ok}`);
  console.log(`mismatches: ${mismatches.length}`);
  if (mismatches.length) {
    console.log("mismatch_health_ids:");
    for (const id of mismatches) console.log(`  - ${id}`);
  }

  // 5 random live checks
  const shuffled = [...rows.map((r) => r.health_id)].sort(
    () => Math.random() - 0.5
  );
  await lightLiveCheck(shuffled.slice(0, 5), byId);

  if (mismatches.length || ok !== rows.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
