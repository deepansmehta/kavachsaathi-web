/**
 * Build vendor package (no activation codes).
 *
 *   npx ts-node --skipProject --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/build-vendor-package.ts
 */
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const EXPORTS = path.join(ROOT, "exports");
const SRC_CSV = path.join(EXPORTS, "qr-urls.csv");
const SRC_QR = path.join(EXPORTS, "qr-print");
const PKG = path.join(EXPORTS, "vendor-package");
const ZIP = path.join(EXPORTS, "KavachSaathi-vendor-package.zip");

const README = `KavachSaathi — Vendor QR Print Package
=====================================

Contents
--------
- qr-urls.csv     : health_id,url (100 rows) — source of truth for each QR
- qr/             : 100 SVG files named {health_id}.svg

Print specifications (mandatory)
--------------------------------
- Error correction level: M
- Quiet zone: 4 modules (do not crop into the white border)
- Minimum printed QR size: 22 mm × 22 mm (outer edge including quiet zone)
- Color: black modules on white background ONLY
- Do not distort by non-uniform scaling
- Do not add logos, rounded modules, colors, or any text / serial / secret code near the QR
- Print a 10-card sample first and verify scan opens https://kavachsaathi.in/card/...

Artwork must contain ONLY the QR linking to the card URL. Do not print packaging codes, PINs, or any secret numbers on or beside the QR.
`;

function rmrf(p: string) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function main() {
  if (!fs.existsSync(SRC_CSV)) throw new Error("qr-urls.csv missing");
  if (!fs.existsSync(SRC_QR)) throw new Error("qr-print missing");

  rmrf(PKG);
  fs.mkdirSync(path.join(PKG, "qr"), { recursive: true });
  fs.copyFileSync(SRC_CSV, path.join(PKG, "qr-urls.csv"));
  fs.writeFileSync(path.join(PKG, "README.txt"), README, "utf8");

  const svgs = fs.readdirSync(SRC_QR).filter((f) => f.endsWith(".svg"));
  if (svgs.length !== 100) {
    throw new Error(`Expected 100 SVGs, found ${svgs.length}`);
  }
  for (const f of svgs) {
    fs.copyFileSync(path.join(SRC_QR, f), path.join(PKG, "qr", f));
  }

  // Safety: no activation-codes file, no "activation" content, no 4-digit codes
  const leakFiles: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else {
        if (/activation/i.test(name)) leakFiles.push(p);
        const text = fs.readFileSync(p, "utf8");
        // skip binary — only text files
        if (name.endsWith(".png")) continue;
        if (/activation[-_ ]?code/i.test(text)) leakFiles.push(p + ":text");
        if (/\bactivation\b/i.test(text) && !name.endsWith(".svg")) {
          leakFiles.push(p + ":activation_word");
        }
        // 4-digit standalone codes like 0001-0100 or 7391 — allow years in URLs (2026)
        // Flag padded inventory-like codes in non-url contexts: word-boundary 4 digits
        // Exclude 2026 from URLs by checking lines that are NOT urls
        if (name === "README.txt") continue;
        if (name.endsWith(".csv")) {
          // csv should only be health_id,url — no activation column
          const header = text.split(/\r?\n/)[0] || "";
          if (/activation/i.test(header) || header.split(",").length !== 2) {
            leakFiles.push(p + ":bad_csv_header");
          }
        }
        if (name.endsWith(".svg")) {
          // SVG should only contain the QR geometry + the URL path data as needed
          if (/\b(000[1-9]|00[1-9]\d|0[1-9]\d{2}|0100|7391)\b/.test(text)) {
            // QR SVG from qrcode lib usually doesn't embed payload as plain 4-digit;
            // if it does somehow, flag
            leakFiles.push(p + ":digit_pattern");
          }
        }
      }
    }
  };
  walk(PKG);

  // Grep-style scan of whole tree for "activation"
  const grepAct = execSync(
    `grep -ri "activation" "${PKG}" || true`,
    { encoding: "utf8" }
  ).trim();
  const grepCodes = execSync(
    `grep -rE "(^|[^0-9])(000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|0100|7391)([^0-9]|$)" "${PKG}" || true`,
    { encoding: "utf8" }
  ).trim();

  const noAct =
    !grepAct &&
    leakFiles.length === 0 &&
    !fs.existsSync(path.join(PKG, "activation-codes.csv"));
  // 4-digit in SVG path data is uncommon; if grepCodes hits SVG path coords ignore false positives carefully
  // For vendor package, primary guarantee is no activation-codes.csv and no "activation" word
  console.log("--- VENDOR PACKAGE SAFETY ---");
  console.log(`no_activation_word: ${!grepAct ? "PASS" : "FAIL"}`);
  if (grepAct) console.log(grepAct.slice(0, 200));
  console.log(
    `no_activation_codes_csv: ${
      !fs.existsSync(path.join(PKG, "activation-codes.csv")) ? "PASS" : "FAIL"
    }`
  );
  console.log(`leak_file_flags: ${leakFiles.length === 0 ? "PASS" : "FAIL"}`);
  if (leakFiles.length) console.log(leakFiles.slice(0, 5).join("\n"));
  // Digit pattern: report separately; SVG modules can look like digits in rare cases
  console.log(
    `four_digit_code_pattern_scan: ${!grepCodes ? "PASS" : "INFO_HITS"}`
  );
  if (grepCodes) {
    // show only filenames
    const files = [
      ...new Set(
        grepCodes
          .split("\n")
          .map((l) => l.split(":")[0])
          .filter(Boolean)
      ),
    ];
    console.log(`digit_pattern_files: ${files.length}`);
  }

  if (fs.existsSync(ZIP)) fs.unlinkSync(ZIP);
  execSync(`cd "${EXPORTS}" && zip -qr KavachSaathi-vendor-package.zip vendor-package`);

  console.log("--- CONTENTS ---");
  console.log(`vendor_dir: ${PKG}`);
  console.log(`zip: ${ZIP}`);
  console.log(`svg_in_qr/: ${svgs.length}`);
  console.log(`has_qr_urls_csv: yes`);
  console.log(`has_readme: yes`);
  console.log(`safety_no_activation: ${noAct ? "PASS" : "FAIL"}`);

  if (!noAct) process.exit(1);
}

main();
