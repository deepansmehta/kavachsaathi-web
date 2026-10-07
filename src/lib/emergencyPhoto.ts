/**
 * Emergency scan photo: resize to fixed 96×96 WebP ≤ ~40 KB for LCP.
 * Uses in-memory + Storage thumb cache so sharp does not run on every scan.
 */
import sharp from "sharp";
import {
  getBucket,
  getObjectBytes,
  isStorageConfigured,
} from "./storage";

const SIZE = 96;
const MAX_BYTES = 40 * 1024;
const mem = new Map<string, string>();

function thumbPathFor(path: string): string {
  if (path.toLowerCase().endsWith(".webp") && path.includes("-thumb")) {
    return path;
  }
  const dot = path.lastIndexOf(".");
  const base = dot > 0 ? path.slice(0, dot) : path;
  return `${base}-thumb96.webp`;
}

async function toWebpThumb(buf: Buffer): Promise<Buffer | null> {
  let webp = await sharp(buf)
    .rotate()
    .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
    .webp({ quality: 70, effort: 2 })
    .toBuffer();
  if (webp.length > MAX_BYTES) {
    webp = await sharp(buf)
      .rotate()
      .resize(SIZE, SIZE, { fit: "cover" })
      .webp({ quality: 50, effort: 2 })
      .toBuffer();
  }
  if (webp.length > MAX_BYTES) return null;
  return webp;
}

/**
 * Returns a data URL for SSR, or null.
 * Prefer cached Storage thumb; only run sharp on cache miss.
 */
export async function emergencyPhotoDataUrl(
  pathOrUrl: string | null | undefined
): Promise<string | null> {
  if (!pathOrUrl) return null;
  const cached = mem.get(pathOrUrl);
  if (cached) return cached;

  try {
    // Storage path — check prebuilt thumb first (fast path)
    if (!pathOrUrl.startsWith("http") && isStorageConfigured() && pathOrUrl.includes("/")) {
      const tPath = thumbPathFor(pathOrUrl);
      let thumbBuf = await getObjectBytes(tPath);
      if (!thumbBuf) {
        const original = await getObjectBytes(pathOrUrl);
        if (!original) return null;
        thumbBuf = await toWebpThumb(original);
        if (!thumbBuf) return null;
        // Persist thumb for next scans (best-effort)
        try {
          await getBucket()
            .file(tPath)
            .save(thumbBuf, {
              contentType: "image/webp",
              resumable: false,
              metadata: { cacheControl: "private, max-age=300" },
            });
        } catch {
          /* ignore persist errors */
        }
      }
      if (thumbBuf.length > MAX_BYTES) return null;
      const dataUrl = `data:image/webp;base64,${thumbBuf.toString("base64")}`;
      mem.set(pathOrUrl, dataUrl);
      return dataUrl;
    }

    if (pathOrUrl.startsWith("http")) {
      const res = await fetch(pathOrUrl, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const thumbBuf = await toWebpThumb(buf);
      if (!thumbBuf) return null;
      const dataUrl = `data:image/webp;base64,${thumbBuf.toString("base64")}`;
      mem.set(pathOrUrl, dataUrl);
      return dataUrl;
    }
  } catch {
    return null;
  }
  return null;
}
