import { getStorage } from "firebase-admin/storage";
import { getAdminApp } from "./firebase-admin";

export function storageBucketName(): string | null {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    null
  );
}

export function getBucket() {
  const name = storageBucketName();
  if (!name) throw new Error("FIREBASE_STORAGE_BUCKET is not configured");
  return getStorage(getAdminApp()).bucket(name);
}

export function isStorageConfigured(): boolean {
  return Boolean(storageBucketName());
}

/** Magic-byte sniff for jpeg/png/pdf */
export function sniffContentType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buf.length >= 5 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  ) {
    return "application/pdf";
  }
  return null;
}

export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

export function maxBytesForType(contentType: string): number {
  if (contentType === "application/pdf") return 8 * 1024 * 1024;
  return 3 * 1024 * 1024;
}

export async function getSignedPutUrl(opts: {
  path: string;
  contentType: string;
  expiresMs?: number;
}): Promise<string> {
  const bucket = getBucket();
  const file = bucket.file(opts.path);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + (opts.expiresMs ?? 10 * 60_000),
    contentType: opts.contentType,
  });
  return url;
}

export async function getSignedGetUrl(opts: {
  path: string;
  expiresMs?: number;
}): Promise<string> {
  const bucket = getBucket();
  const file = bucket.file(opts.path);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + (opts.expiresMs ?? 5 * 60_000),
  });
  return url;
}

export async function verifyUploadedObject(opts: {
  path: string;
  expectedType: string;
}): Promise<{ ok: true; size: number } | { ok: false; error: string }> {
  const bucket = getBucket();
  const file = bucket.file(opts.path);
  const [exists] = await file.exists();
  if (!exists) return { ok: false, error: "Upload missing" };
  const [meta] = await file.getMetadata();
  const size = Number(meta.size || 0);
  const max = maxBytesForType(opts.expectedType);
  if (size <= 0 || size > max) {
    await file.delete({ ignoreNotFound: true }).catch(() => {});
    return { ok: false, error: "File too large or empty" };
  }
  const [buf] = await file.download({ start: 0, end: 15 });
  const sniffed = sniffContentType(buf);
  if (!sniffed || sniffed !== opts.expectedType) {
    await file.delete({ ignoreNotFound: true }).catch(() => {});
    return { ok: false, error: "File type not allowed" };
  }
  return { ok: true, size };
}

export async function moveObject(fromPath: string, toPath: string) {
  const bucket = getBucket();
  const src = bucket.file(fromPath);
  await src.copy(bucket.file(toPath));
  await src.delete({ ignoreNotFound: true }).catch(() => {});
}

export async function deletePrefix(prefix: string): Promise<number> {
  if (!isStorageConfigured()) return 0;
  const bucket = getBucket();
  const [files] = await bucket.getFiles({ prefix });
  let n = 0;
  for (const f of files) {
    await f.delete({ ignoreNotFound: true }).catch(() => {});
    n += 1;
  }
  return n;
}
