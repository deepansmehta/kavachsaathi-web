/**
 * /api/follow-up — Medicine schedule + upcoming visits.
 *
 * Subcollections on the profile doc:
 *   follow_up_medicines  (max 20)
 *   follow_up_visits     (max 30)
 *
 * Auth: profile session only (no hospital emergency access).
 *
 * GET    /api/follow-up              → { medicines[], visits[] }
 * POST   /api/follow-up              → create medicine or visit
 *        body: { kind: "medicine"|"visit", ...fields }
 * PATCH  /api/follow-up?id=&kind=   → update a record
 * DELETE /api/follow-up?id=&kind=   → delete a record
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireFeature } from "@/lib/features/server";
import {
  PROFILE_SESSION_COOKIE,
  verifyProfileSessionToken,
} from "@/lib/profileSession";
import { getAdminDb } from "@/lib/firebase-admin";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  MAX_MEDICINES,
  MAX_VISITS,
  ALLOWED_FREQUENCIES,
  ALLOWED_VISIT_TYPES,
  type MedFrequency,
  type VisitType,
} from "@/lib/patientEase/followUp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getProfileId(req: NextRequest): Promise<string | null> {
  const tok = req.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  const sess = verifyProfileSessionToken(tok);
  if (!sess) return null;
  const db = getAdminDb();
  const snap = await db.collection("profiles").doc(sess.profileId).get();
  if (!snap.exists) return null;
  return sess.profileId;
}

export async function GET(req: NextRequest) {
  const flags = await requireFeature("followUpPlanner");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const profileId = await getProfileId(req);
  if (!profileId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  const base = db.collection("profiles").doc(profileId);

  const [medSnap, visitSnap] = await Promise.all([
    base.collection("follow_up_medicines").orderBy("createdAt", "asc").limit(MAX_MEDICINES).get(),
    base.collection("follow_up_visits").orderBy("dueDate", "asc").limit(MAX_VISITS).get(),
  ]);

  const medicines = medSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const visits = visitSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return NextResponse.json({ medicines, visits }, { headers: noStoreHeaders() });
}

export async function POST(req: NextRequest) {
  const flags = await requireFeature("followUpPlanner");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const profileId = await getProfileId(req);
  if (!profileId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const body = await req.json();
  const kind = String(body.kind || "");
  const db = getAdminDb();
  const base = db.collection("profiles").doc(profileId);
  const now = new Date().toISOString();

  if (kind === "medicine") {
    const countSnap = await base.collection("follow_up_medicines").count().get();
    if (countSnap.data().count >= MAX_MEDICINES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_MEDICINES} medicines allowed` },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    const frequency = String(body.frequency || "once_daily") as MedFrequency;
    if (!ALLOWED_FREQUENCIES.includes(frequency)) {
      return NextResponse.json(
        { error: "Invalid frequency" },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    const doc: Record<string, unknown> = {
      name,
      dose: String(body.dose || "").trim() || null,
      frequency,
      startDate: String(body.startDate || "").trim() || null,
      endDate: String(body.endDate || "").trim() || null,
      notes: String(body.notes || "").trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await base.collection("follow_up_medicines").add(doc);
    return NextResponse.json({ id: ref.id, success: true }, { headers: noStoreHeaders() });
  }

  if (kind === "visit") {
    const countSnap = await base.collection("follow_up_visits").count().get();
    if (countSnap.data().count >= MAX_VISITS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_VISITS} visits allowed` },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    const title = String(body.title || "").trim();
    const dueDate = String(body.dueDate || "").trim();
    if (!title || !dueDate) {
      return NextResponse.json(
        { error: "title and dueDate are required" },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    const type = String(body.type || "follow_up") as VisitType;
    if (!ALLOWED_VISIT_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Invalid type" },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    const doc: Record<string, unknown> = {
      type,
      title,
      dueDate,
      doctor: String(body.doctor || "").trim() || null,
      hospital: String(body.hospital || "").trim() || null,
      notes: String(body.notes || "").trim() || null,
      done: false,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await base.collection("follow_up_visits").add(doc);
    return NextResponse.json({ id: ref.id, success: true }, { headers: noStoreHeaders() });
  }

  return NextResponse.json(
    { error: "kind must be 'medicine' or 'visit'" },
    { status: 400, headers: noStoreHeaders() }
  );
}

export async function PATCH(req: NextRequest) {
  const flags = await requireFeature("followUpPlanner");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const profileId = await getProfileId(req);
  if (!profileId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const id = req.nextUrl.searchParams.get("id");
  const kind = req.nextUrl.searchParams.get("kind");
  if (!id || !kind) {
    return NextResponse.json(
      { error: "id and kind are required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const collection =
    kind === "medicine" ? "follow_up_medicines" : kind === "visit" ? "follow_up_visits" : null;
  if (!collection) {
    return NextResponse.json(
      { error: "kind must be 'medicine' or 'visit'" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  const ref = db
    .collection("profiles")
    .doc(profileId)
    .collection(collection)
    .doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const body = await req.json();
  const allowed =
    kind === "medicine"
      ? ["name", "dose", "frequency", "startDate", "endDate", "notes"]
      : ["title", "type", "dueDate", "doctor", "hospital", "notes", "done"];

  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) {
      if (key === "done") {
        patch[key] = Boolean(body[key]);
      } else if (key === "frequency") {
        const f = String(body[key]) as MedFrequency;
        if (!ALLOWED_FREQUENCIES.includes(f)) continue;
        patch[key] = f;
      } else if (key === "type") {
        const t = String(body[key]) as VisitType;
        if (!ALLOWED_VISIT_TYPES.includes(t)) continue;
        patch[key] = t;
      } else {
        patch[key] = String(body[key] || "").trim() || FieldValue.delete();
      }
    }
  }

  await ref.update(patch);
  return NextResponse.json({ success: true }, { headers: noStoreHeaders() });
}

export async function DELETE(req: NextRequest) {
  const flags = await requireFeature("followUpPlanner");
  if (!flags) {
    return NextResponse.json(
      { error: "Feature not available", code: "FEATURE_OFF" },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const profileId = await getProfileId(req);
  if (!profileId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  const id = req.nextUrl.searchParams.get("id");
  const kind = req.nextUrl.searchParams.get("kind");
  if (!id || !kind) {
    return NextResponse.json(
      { error: "id and kind are required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const collection =
    kind === "medicine" ? "follow_up_medicines" : kind === "visit" ? "follow_up_visits" : null;
  if (!collection) {
    return NextResponse.json(
      { error: "kind must be 'medicine' or 'visit'" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const db = getAdminDb();
  await db
    .collection("profiles")
    .doc(profileId)
    .collection(collection)
    .doc(id)
    .delete();

  return NextResponse.json({ success: true }, { headers: noStoreHeaders() });
}
