/**
 * Order notification emails via Gmail SMTP (Nodemailer).
 * Server-only — never import from client components.
 *
 * Env:
 *   GMAIL_APP_PASSWORD  — required (Google App Password)
 *   GMAIL_USER          — optional, default gdmtechnoworld@gmail.com
 *   ORDER_NOTIFY_EMAIL  — optional admin inbox, default same as GMAIL_USER
 */
import nodemailer from "nodemailer";
import { formatInr } from "@/lib/pricing";

export type PaidOrderEmailPayload = {
  orderNo: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  pack: string;
  cardsLabel: string;
  qty: number;
  amountInr: number;
  razorpay_payment_id?: string;
};

function mailConfig(): {
  user: string;
  pass: string;
  notifyTo: string;
} | null {
  const pass = (process.env.GMAIL_APP_PASSWORD || "").trim();
  if (!pass || pass === "YOUR_16_CHAR_APP_PASSWORD") return null;
  const user = (
    process.env.GMAIL_USER ||
    "gdmtechnoworld@gmail.com"
  ).trim();
  const notifyTo = (
    process.env.ORDER_NOTIFY_EMAIL ||
    user
  ).trim();
  return { user, pass, notifyTo };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * After a paid order is saved: notify admin + customer.
 * Never throws — logs and returns ok flags so checkout is not blocked.
 */
export async function sendPaidOrderEmails(
  order: PaidOrderEmailPayload
): Promise<{ admin: boolean; customer: boolean }> {
  const cfg = mailConfig();
  if (!cfg) {
    console.warn(
      "[order-email] GMAIL_APP_PASSWORD not set — skipped order emails for",
      order.orderNo
    );
    return { admin: false, customer: false };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const result = { admin: false, customer: false };
  const safe = {
    orderNo: escapeHtml(order.orderNo),
    name: escapeHtml(order.name),
    phone: escapeHtml(order.phone),
    email: escapeHtml(order.email || "—"),
    address: escapeHtml(order.address).replace(/\n/g, "<br/>"),
    pack: escapeHtml(order.pack),
    cards: escapeHtml(order.cardsLabel),
    qty: String(order.qty),
    amount: escapeHtml(formatInr(order.amountInr)),
    payId: escapeHtml(order.razorpay_payment_id || "—"),
  };

  try {
    await transporter.sendMail({
      from: `"KavachSaathi Orders" <${cfg.user}>`,
      to: cfg.notifyTo,
      subject: `[KavachSaathi] Paid order ${order.orderNo} — ${formatInr(order.amountInr)}`,
      html: `
        <div style="font-family:sans-serif;background:#111111;color:#E6DFC8;padding:24px;max-width:560px">
          <h2 style="color:#D4AF37;margin:0 0 16px">New paid order</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#A8A59C">Order no.</td><td style="padding:6px 0;font-family:monospace"><b>${safe.orderNo}</b></td></tr>
            <tr><td style="padding:6px 0;color:#A8A59C">Customer</td><td style="padding:6px 0">${safe.name}</td></tr>
            <tr><td style="padding:6px 0;color:#A8A59C">Phone</td><td style="padding:6px 0">+91 ${safe.phone}</td></tr>
            <tr><td style="padding:6px 0;color:#A8A59C">Email</td><td style="padding:6px 0">${safe.email}</td></tr>
            <tr><td style="padding:6px 0;color:#A8A59C;vertical-align:top">Shipping</td><td style="padding:6px 0">${safe.address}</td></tr>
            <tr><td style="padding:6px 0;color:#A8A59C">Pack / product</td><td style="padding:6px 0">${safe.pack} (${safe.cards})</td></tr>
            <tr><td style="padding:6px 0;color:#A8A59C">Quantity</td><td style="padding:6px 0">${safe.qty}</td></tr>
            <tr><td style="padding:6px 0;color:#A8A59C">Amount paid</td><td style="padding:6px 0;color:#D4AF37"><b>${safe.amount}</b></td></tr>
            <tr><td style="padding:6px 0;color:#A8A59C">Razorpay payment</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${safe.payId}</td></tr>
          </table>
          <p style="margin-top:20px;font-size:12px;color:#888">Status: paid · Free delivery · Do not auto-activate</p>
        </div>
      `,
      text: [
        `Paid order ${order.orderNo}`,
        `Name: ${order.name}`,
        `Phone: +91 ${order.phone}`,
        `Email: ${order.email || "—"}`,
        `Address: ${order.address}`,
        `Pack: ${order.pack} (${order.cardsLabel})`,
        `Qty: ${order.qty}`,
        `Amount: ${formatInr(order.amountInr)}`,
        `Payment ID: ${order.razorpay_payment_id || "—"}`,
      ].join("\n"),
    });
    result.admin = true;
  } catch (err) {
    console.error("[order-email] admin notify failed", order.orderNo, err);
  }

  const customerTo = (order.email || "").trim();
  if (customerTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerTo)) {
    try {
      await transporter.sendMail({
        from: `"KavachSaathi" <${cfg.user}>`,
        to: customerTo,
        replyTo: cfg.notifyTo,
        subject: `KavachSaathi order confirmed — ${order.orderNo}`,
        html: `
          <div style="font-family:sans-serif;background:#111111;color:#E6DFC8;padding:24px;max-width:560px">
            <h2 style="color:#D4AF37;margin:0 0 16px">Payment successful</h2>
            <p>Hi ${safe.name},</p>
            <p>Thank you for ordering KavachSaathi. Your payment is confirmed.</p>
            <p><b>Order number:</b> <span style="font-family:monospace;color:#D4AF37">${safe.orderNo}</span></p>
            <p><b>Amount paid:</b> ${safe.amount}</p>
            <p><b>Pack:</b> ${safe.pack} × ${safe.qty}</p>
            <p style="margin-top:20px">Your KavachSaathi card will be shipped soon to the address you provided (FREE delivery).</p>
            <p>Once you receive it, scan the QR and activate it with the activation code on the box. Cards are not auto-activated after payment.</p>
            <p style="margin-top:24px;font-size:12px;color:#888">
              Helpline: +91 72730 00075 · +91 73001 00102<br/>
              ${escapeHtml(cfg.notifyTo)}
            </p>
          </div>
        `,
        text: [
          `Hi ${order.name},`,
          ``,
          `Payment successful. Order number: ${order.orderNo}`,
          `Amount paid: ${formatInr(order.amountInr)}`,
          `Pack: ${order.pack} × ${order.qty}`,
          ``,
          `Your KavachSaathi card will be shipped soon.`,
          `Activate after delivery with the code on the box.`,
        ].join("\n"),
      });
      result.customer = true;
    } catch (err) {
      console.error(
        "[order-email] customer confirmation failed",
        order.orderNo,
        err
      );
    }
  }

  return result;
}
