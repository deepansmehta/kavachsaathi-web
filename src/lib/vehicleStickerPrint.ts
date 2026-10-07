/**
 * F50 — Print-ready vehicle sticker PNG (QR → adaptive /card/{health_id} URL).
 * Same URL logic as owner my-card / packaging QR; no activation code or PIN on art.
 */
import QRCode from "qrcode";
import sharp from "sharp";
import { getCardUrl, PRODUCT_SITE } from "@/lib/product-flow";

const W = 900;
const H = 420;

export async function buildVehicleStickerPrintPng(opts: {
  healthId: string;
  bloodGroup?: string;
}): Promise<Buffer> {
  const hid = String(opts.healthId || "")
    .trim()
    .toUpperCase();
  const url = getCardUrl(hid, PRODUCT_SITE);
  const blood = String(opts.bloodGroup || "—").trim() || "—";

  const qrSize = 320;
  const qrPng = await QRCode.toBuffer(url, {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: "M",
    type: "png",
  });

  const title = "KavachSaathi · Emergency QR";
  const sub = hid;
  const footer = "Scan for medical profile · KavachSaathi.in";

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#FAFAF7"/>
  <rect x="0" y="0" width="100%" height="8" fill="#D4AF37"/>
  <text x="360" y="52" font-family="system-ui,sans-serif" font-size="28" font-weight="700" fill="#0B0812">${escapeXml(title)}</text>
  <text x="360" y="88" font-family="ui-monospace,monospace" font-size="22" fill="#5C5348">${escapeXml(sub)}</text>
  <text x="360" y="130" font-family="system-ui,sans-serif" font-size="20" fill="#8B0000">Blood: ${escapeXml(blood)}</text>
  <text x="360" y="360" font-family="system-ui,sans-serif" font-size="16" fill="#5C5348">${escapeXml(footer)}</text>
</svg>`;

  const base = await sharp(Buffer.from(svg)).png().toBuffer();

  return sharp(base)
    .composite([{ input: qrPng, top: 48, left: 24 }])
    .png()
    .toBuffer();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
