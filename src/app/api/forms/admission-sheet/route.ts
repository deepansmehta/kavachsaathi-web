import { NextRequest } from "next/server";
import { handleAdmissionDownload } from "@/lib/forms/downloadService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET — admission info sheet (PIN full / emergency limited). Never stored. */
export async function GET(req: NextRequest) {
  try {
    return await handleAdmissionDownload(req);
  } catch (err) {
    console.error(
      "forms/admission-sheet",
      err instanceof Error ? err.message : "fail"
    );
    return Response.json({ error: "Failed to generate sheet" }, { status: 500 });
  }
}
