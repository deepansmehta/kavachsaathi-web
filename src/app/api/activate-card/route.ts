import { NextResponse } from "next/server";

/**
 * DEPRECATED — old Phone-Auth (OTP) activation endpoint.
 * Use POST /api/card/activate (activation_code + bcrypt PIN, no OTP).
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Use POST /api/card/activate with activation_code + PIN.",
      code: "DEPRECATED_OTP_ACTIVATE",
    },
    { status: 410 }
  );
}
