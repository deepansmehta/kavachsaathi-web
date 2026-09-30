/** Client-side image compress (canvas) — no external service */
export async function compressImageFile(
  file: File,
  maxPx = 1600,
  quality = 0.8
): Promise<{ blob: Blob; contentType: "image/jpeg" }> {
  if (file.type === "application/pdf") {
    throw new Error("Use compress only for images");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compress failed"))),
      "image/jpeg",
      quality
    );
  });
  return { blob, contentType: "image/jpeg" };
}

export async function uploadViaSignedPut(opts: {
  kind: string;
  file: File;
}): Promise<{ path: string; contentType: string }> {
  let blob: Blob = opts.file;
  let contentType = opts.file.type || "application/octet-stream";

  if (contentType.startsWith("image/")) {
    const compressed = await compressImageFile(opts.file);
    blob = compressed.blob;
    contentType = compressed.contentType;
  } else if (contentType !== "application/pdf") {
    throw new Error("Only JPEG, PNG, or PDF allowed");
  }

  const signed = await fetch("/api/uploads/signed-put", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: opts.kind, contentType }),
  });
  const data = await signed.json();
  if (!signed.ok) throw new Error(data.error || "Could not get upload URL");

  const put = await fetch(data.url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!put.ok) throw new Error("Upload failed");

  const confirm = await fetch("/api/uploads/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: data.path, contentType }),
  });
  const conf = await confirm.json();
  if (!confirm.ok) throw new Error(conf.error || "Upload rejected");

  return { path: data.path, contentType };
}
