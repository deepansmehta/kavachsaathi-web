/**
 * Generate print-ready QR assets from exports/qr-urls.csv ONLY.
 * Never reads activation-codes.csv.
 *
 *   npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/generate-qr-print.ts
 */
import * as fs from "fs";
import * as path from "path";
import QRCode from "qrcode";

const ROOT = process.cwd();
const CSV = path.join(ROOT, "exports", "qr-urls.csv");
const OUT = path.join(ROOT, "exports", "qr-print");
const PNG_SIZE = 1200;

type Row = { health_id: string; url: string };

function loadCsv(): Row[] {
  if (!fs.existsSync(CSV)) {
    throw new Error("exports/qr-urls.csv missing");
  }
  const lines = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/);
  const header = lines[0]?.toLowerCase() || "";
  if (!header.startsWith("health_id") || !header.includes("url")) {
    throw new Error("CSV must have health_id,url columns only");
  }
  return lines.slice(1).map((line, i) => {
    const [health_id, url] = line.split(",").map((s) => s.trim());
    if (!health_id || !url) throw new Error(`Bad CSV row ${i + 2}`);
    return { health_id, url };
  });
}

function validate(rows: Row[]) {
  const errors: string[] = [];
  if (rows.length !== 100) errors.push(`count=${rows.length} want 100`);
  const ids = new Set<string>();
  const urls = new Set<string>();
  for (const r of rows) {
    const expected = `https://kavachsaathi.in/card/${r.health_id}`;
    if (r.url !== expected) errors.push(`url_mismatch:${r.health_id}`);
    if (!/^KVS-2026-[A-Z0-9]{5}$/i.test(r.health_id)) {
      errors.push(`bad_id:${r.health_id}`);
    }
    if (/DEMO/i.test(r.health_id) || /DEMO/i.test(r.url)) {
      errors.push(`demo_present:${r.health_id}`);
    }
    if (ids.has(r.health_id)) errors.push(`dup_id:${r.health_id}`);
    if (urls.has(r.url)) errors.push(`dup_url:${r.health_id}`);
    ids.add(r.health_id);
    urls.add(r.url);
  }
  // same URL length → same QR version class
  const lens = new Set(rows.map((r) => r.url.length));
  if (lens.size !== 1) errors.push(`url_length_not_uniform:${[...lens].join(",")}`);

  console.log("--- CSV VALIDATION ---");
  console.log(`rows: ${rows.length}`);
  console.log(`unique_health_id: ${ids.size}`);
  console.log(`url_length: ${[...lens][0] ?? "?"}`);
  console.log(`result: ${errors.length === 0 ? "OK" : "FAIL"}`);
  if (errors.length) {
    console.log(`errors: ${errors.slice(0, 10).join("; ")}`);
    throw new Error("CSV validation failed");
  }
}

async function main() {
  const rows = loadCsv();
  validate(rows);

  fs.mkdirSync(OUT, { recursive: true });
  // wipe previous assets only inside qr-print
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith(".svg") || f.endsWith(".png")) {
      fs.unlinkSync(path.join(OUT, f));
    }
  }

  const svgOpts: QRCode.QRCodeToStringOptions = {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    color: { dark: "#000000", light: "#FFFFFF" },
  };
  const pngOpts: QRCode.QRCodeToFileOptions = {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 4,
    width: PNG_SIZE,
    color: { dark: "#000000", light: "#FFFFFF" },
  };

  // Probe QR version from first URL (via create)
  const probe = await QRCode.create(rows[0].url, {
    errorCorrectionLevel: "M",
  });
  const version = probe.version;
  console.log(`qr_version: ${version}`);
  console.log(`error_correction: M`);
  console.log(`quiet_zone_modules: 4`);
  console.log(`png_size: ${PNG_SIZE}x${PNG_SIZE}`);

  let svgCount = 0;
  let pngCount = 0;
  for (const r of rows) {
    const svgPath = path.join(OUT, `${r.health_id}.svg`);
    const pngPath = path.join(OUT, `${r.health_id}.png`);
    const svg = await QRCode.toString(r.url, svgOpts);
    fs.writeFileSync(svgPath, svg, "utf8");
    svgCount += 1;
    await QRCode.toFile(pngPath, r.url, pngOpts);
    pngCount += 1;

    // enforce same version
    const q = await QRCode.create(r.url, { errorCorrectionLevel: "M" });
    if (q.version !== version) {
      throw new Error(
        `QR version mismatch for ${r.health_id}: ${q.version} != ${version}`
      );
    }
  }

  console.log("--- GENERATION ---");
  console.log(`svg_count: ${svgCount}`);
  console.log(`png_count: ${pngCount}`);
  console.log(`out_dir: ${OUT}`);
  console.log(`qr_version_used: ${version}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
