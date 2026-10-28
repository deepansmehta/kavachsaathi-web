/**
 * Client-side Razorpay Checkout helper (browser only).
 * Uses NEXT_PUBLIC_RAZORPAY_KEY_ID — never the secret.
 */

export type CheckoutCustomer = {
  name: string;
  phone: string;
  email?: string;
  address: string;
};

export type CreateOrderResponse = {
  ok?: boolean;
  error?: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  localOrderNo: string;
  pack: string;
  qty: number;
  amountInr: number;
  customer: CheckoutCustomer;
};

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (r: unknown) => void) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Razorpay Checkout"));
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export async function createPaymentOrder(payload: {
  name: string;
  phone: string;
  email?: string;
  address: string;
  pack: string;
  quantity: number;
  source?: string;
}): Promise<CreateOrderResponse> {
  const r = await fetch("/api/payment/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = (await r.json().catch(() => ({}))) as CreateOrderResponse & {
    error?: string;
  };
  if (!r.ok || !j.orderId) {
    throw new Error(j.error || "Could not create payment order");
  }
  return j;
}

export async function openRazorpayCheckout(opts: {
  order: CreateOrderResponse;
  source?: string;
  onDismiss?: () => void;
}): Promise<{
  orderNo: string;
  amount: number;
  message?: string;
}> {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error("Razorpay unavailable");

  const { order, source } = opts;
  const key =
    order.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key,
      amount: order.amount,
      currency: order.currency || "INR",
      name: "KavachSaathi",
      description: `Smart QR Emergency Health Card — ${order.pack}`,
      order_id: order.orderId,
      prefill: {
        name: order.customer.name,
        contact: order.customer.phone,
        email: order.customer.email || "",
      },
      notes: {
        localOrderNo: order.localOrderNo,
        pack: order.pack,
        address: order.customer.address.slice(0, 200),
      },
      theme: { color: "#C9A227" },
      handler: async (response: RazorpaySuccess) => {
        try {
          const v = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              localOrderNo: order.localOrderNo,
              name: order.customer.name,
              phone: order.customer.phone,
              email: order.customer.email,
              address: order.customer.address,
              pack: order.pack,
              quantity: order.qty,
              source: source || "web_razorpay",
            }),
          });
          const j = (await v.json().catch(() => ({}))) as {
            ok?: boolean;
            error?: string;
            orderNo?: string;
            amount?: number;
            message?: string;
          };
          if (!v.ok || !j.ok || !j.orderNo) {
            reject(new Error(j.error || "Payment verification failed"));
            return;
          }
          resolve({
            orderNo: j.orderNo,
            amount: Number(j.amount || order.amountInr),
            message: j.message,
          });
        } catch (e) {
          reject(e instanceof Error ? e : new Error("Verify failed"));
        }
      },
      modal: {
        ondismiss: () => {
          opts.onDismiss?.();
          reject(new Error("Payment cancelled"));
        },
      },
    });
    rzp.on("payment.failed", () => {
      opts.onDismiss?.();
      reject(
        new Error(
          "Payment failed. No paid order was created — please retry."
        )
      );
    });
    rzp.open();
  });
}
