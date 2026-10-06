import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

function adminEmails(): Set<string> {
  const raw =
    process.env.ADMIN_EMAILS ||
    "gdmtechnoworld@gmail.com,mehtadeepansh6@gmail.com";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function requireAdmin(
  req: NextRequest
): Promise<{ uid: string; email: string } | NextResponse> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const email = (decoded.email || "").toLowerCase();
    if (!email || !adminEmails().has(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return { uid: decoded.uid, email };
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** Alias used by Pack 3 routes */
export const requireAdminUser = requireAdmin;

export async function writeAdminLog(
  db: FirebaseFirestore.Firestore,
  entry: {
    action: string;
    byEmail: string;
    health_id?: string | null;
    meta?: Record<string, unknown>;
  }
) {
  await db.collection("admin_logs").add({
    ...entry,
    at: new Date().toISOString(),
  });
}
