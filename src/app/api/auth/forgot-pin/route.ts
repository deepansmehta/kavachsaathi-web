import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import nodemailer from "nodemailer";
import { getAdminDb } from "@/lib/firebase-admin";

const COMPANY_EMAIL = "gdmtechnoworld@gmail.com";

/**
 * POST /api/auth/forgot-pin
 * Body: { phone }
 * 1. Generate 64-char hex reset_token
 * 2. Store in Firestore with 24hr expiry
 * 3. Email gdmtechnoworld@gmail.com via nodemailer
 * 4. Always return { success: true } (never reveal if phone exists)
 */
export async function POST(req: NextRequest) {
  const ok = NextResponse.json({ success: true });

  try {
    const body = await req.json();
    const phone = String(body.phone || "")
      .replace(/\D/g, "")
      .slice(-10);

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return ok;
    }

    const db = getAdminDb();
    const snaps = await db
      .collection("users")
      .where("phone", "==", phone)
      .limit(1)
      .get();

    if (snaps.empty) {
      return ok;
    }

    const userRef = snaps.docs[0].ref;
    const user = snaps.docs[0].data();
    const token = randomBytes(32).toString("hex"); // 64 hex chars
    const expires = Date.now() + 24 * 60 * 60 * 1000;

    await userRef.update({
      reset_token: token,
      reset_token_expires: expires,
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const resetLink = `${baseUrl}/reset-pin?token=${token}`;

    const appPassword = process.env.GMAIL_APP_PASSWORD;
    if (appPassword && appPassword !== "YOUR_16_CHAR_APP_PASSWORD") {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: COMPANY_EMAIL,
          pass: appPassword,
        },
      });

      await transporter.sendMail({
        from: `"KavachSaathi" <${COMPANY_EMAIL}>`,
        to: COMPANY_EMAIL,
        subject: `[KavachSaathi] PIN Reset Request — ${user.full_name || phone}`,
        html: `
          <div style="font-family:sans-serif;background:#111111;color:#E6DFC8;padding:24px">
            <h2 style="color:#D4AF37;margin:0 0 16px">PIN Reset Request</h2>
            <p><b>Name:</b> ${user.full_name || "—"}</p>
            <p><b>Phone:</b> +91 ${phone}</p>
            <p><b>Health ID:</b> <span style="font-family:monospace">${user.health_id || "—"}</span></p>
            <p><b>Activation Code:</b> ${user.activation_code || "—"}</p>
            <p style="margin-top:24px">
              <a href="${resetLink}"
                 style="background:#D4AF37;color:#111111;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block">
                Reset PIN
              </a>
            </p>
            <p style="margin-top:16px;font-size:12px;color:#888">
              Valid 24 hours.<br/>${resetLink}
            </p>
          </div>
        `,
      });
    } else {
      console.warn(
        "[forgot-pin] GMAIL_APP_PASSWORD not set. Reset link:",
        resetLink
      );
    }

    return ok;
  } catch (err) {
    console.error("forgot-pin error", err);
    return ok;
  }
}
