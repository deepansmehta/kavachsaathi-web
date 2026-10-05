import { NextRequest } from "next/server";
import { handleCashlessDownload } from "@/lib/forms/downloadService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET — pre-filled IRDAI cashless form (PIN session only). Never stored. */
export async function GET(req: NextRequest) {
  try {
    return await handleCashlessDownload(req);
  } catch (err) {
    console.error("forms/cashless", err instanceof Error ? err.message : "fail");
    return Response.json({ error: "Failed to generate form" }, { status: 500 });
  }
}
