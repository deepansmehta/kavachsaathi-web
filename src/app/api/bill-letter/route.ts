import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/forms/pdfCommon";
import {
  requireOwnerSession,
  requirePack2Feature,
} from "@/lib/patientEase/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { buildBillLetterPdf } from "@/lib/patientEase/pdfs/billLetterPdf";
import {
  BILL_CHECK_ITEMS,
  NOT_LEGAL_ADVICE,
  billLetterEnglish,
  billLetterHindi,
} from "@/lib/patientEase/billLetter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const feat = await requirePack2Feature("billRequestLetter");
  if (!feat.ok) return feat.res;
  const sess = await requireOwnerSession(req);
  if (!sess.ok) return sess.res;
  const body = await req.json().catch(() => ({}));
  const db = getAdminDb();
  const profile = await db.collection("profiles").doc(sess.profileId).get();
  const name = String(profile.data()?.full_name || body.patientName || "");
  const input = {
    patientName: name,
    hospital: String(body.hospital || "").slice(0, 200),
    ipUhid: String(body.ipUhid || "").slice(0, 80),
    admissionDate: String(body.admissionDate || "").slice(0, 40),
  };
  if (body.format === "json") {
    return NextResponse.json(
      {
        english: billLetterEnglish(input),
        hindi: billLetterHindi(input),
        checklist: BILL_CHECK_ITEMS,
        disclaimer: NOT_LEGAL_ADVICE,
      },
      { headers: noStoreHeaders() }
    );
  }
  const bytes = await buildBillLetterPdf(input);
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...noStoreHeaders(),
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="bill-request-letter.pdf"',
    },
  });
}
