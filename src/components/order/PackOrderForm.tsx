"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  Loader2,
  MapPin,
  QrCode,
  Shield,
  ShieldCheck,
  Truck,
  Users,
  Droplets,
  PhoneCall,
  Lock,
  Award,
} from "lucide-react";
import { LAUNCH_PACKS } from "@/lib/launchReveal";
import { CARD_MRP, CARD_PRICE, formatInr } from "@/lib/pricing";
import {
  createPaymentOrder,
  openRazorpayCheckout,
} from "@/lib/razorpayCheckout";
import { ProductGallery } from "./ProductGallery";

const inputClass =
  "rounded-lg border border-gold/25 bg-kavach-s1 px-3 py-2.5 text-sm text-cream placeholder:text-cream-soft/50 focus:border-gold/60 focus:outline-none";

const BENEFIT_ITEMS: { icon: typeof QrCode; text: string }[] = [
  {
    icon: QrCode,
    text: "One QR scan shows your emergency health info — no app needed",
  },
  {
    icon: Droplets,
    text: "Blood group, allergies, current medicines & medical conditions",
  },
  {
    icon: PhoneCall,
    text: "Emergency contacts shown instantly to any helper",
  },
  {
    icon: ShieldCheck,
    text: "Insurance / policy details on scan",
  },
  {
    icon: Lock,
    text: "PIN-protected — your private data stays safe",
  },
  {
    icon: Shield,
    text: "Waterproof, scratch-resistant premium PVC card",
  },
  {
    icon: Users,
    text: "Works for seniors, bikers, travellers, children & whole family",
  },
  {
    icon: Award,
    text: "Lifetime free emergency access + referral rewards",
  },
];

function composeAddress(parts: {
  line: string;
  city: string;
  state: string;
  pincode: string;
}): string {
  return [parts.line, parts.city, parts.state, parts.pincode]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

export function PackOrderForm({ source = "order_page" }: { source?: string }) {
  const router = useRouter();
  const [packId, setPackId] = useState(LAUNCH_PACKS[0].id);
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [line, setLine] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const pack = useMemo(
    () => LAUNCH_PACKS.find((p) => p.id === packId) || LAUNCH_PACKS[0],
    [packId]
  );
  const total = pack.price * qty;

  const formValid = useMemo(() => {
    const ph = phone.replace(/\D/g, "").slice(-10);
    const pin = pincode.replace(/\D/g, "");
    return (
      name.trim().length >= 2 &&
      /^[6-9]\d{9}$/.test(ph) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
      line.trim().length >= 5 &&
      city.trim().length >= 2 &&
      state.trim().length >= 2 &&
      /^\d{6}$/.test(pin)
    );
  }, [name, phone, email, line, city, state, pincode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!formValid) {
      setErr("Please fill all required fields correctly before paying.");
      return;
    }
    const address = composeAddress({ line, city, state, pincode });
    setBusy(true);
    try {
      const order = await createPaymentOrder({
        name: name.trim(),
        phone: phone.replace(/\D/g, "").slice(-10),
        email: email.trim(),
        address,
        pack: pack.id,
        quantity: qty,
        source,
      });
      const paid = await openRazorpayCheckout({
        order,
        source,
        onDismiss: () => {
          setBusy(false);
          setErr(
            "Payment cancelled. No charge was made — tap Pay again when you’re ready."
          );
        },
      });
      const q = new URLSearchParams({
        orderNo: paid.orderNo,
        amount: String(paid.amount),
      });
      router.push(`/order/success?${q.toString()}`);
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : "Payment failed";
      if (msg === "Payment cancelled") {
        setErr(
          "Payment cancelled. No charge was made — tap Pay again when you’re ready."
        );
      } else {
        setErr(
          msg.includes("verif")
            ? `${msg} Please contact helpline with your payment ID if money was deducted.`
            : `${msg} Please try again — no paid order is created until payment succeeds.`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* Catalog hero: gallery + buy box */}
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10 lg:items-start">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <ProductGallery />
        </motion.div>

        <motion.div
          className="space-y-5"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <p className="font-rajdhani text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              KavachSaathi
            </p>
            <h1 className="mt-2 font-rajdhani text-2xl font-bold leading-tight text-cream sm:text-3xl">
              KavachSaathi – Smart QR Emergency Health Card
            </h1>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-lg text-cream-soft line-through decoration-cream-soft/60">
              {formatInr(CARD_MRP)}
            </span>
            <span className="font-mono text-4xl font-bold text-gold">
              {formatInr(CARD_PRICE)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <Truck className="h-3.5 w-3.5" />
              FREE Delivery
            </span>
          </div>
          <p className="text-xs text-cream-soft">
            Offer price for 1 card · no shipping charge · GST inclusive
          </p>

          <div>
            <h2 className="mb-2 font-rajdhani text-sm font-semibold uppercase tracking-wider text-cream-soft">
              Choose a pack
            </h2>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Pack options"
            >
              {LAUNCH_PACKS.map((p) => {
                const selected = packId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPackId(p.id)}
                    className={`relative rounded-xl border p-3 text-left transition ${
                      selected
                        ? "border-gold bg-gold/10 ring-1 ring-gold/40"
                        : "border-gold/25 bg-kavach-s1/80 hover:border-gold/50"
                    }`}
                  >
                    {p.best ? (
                      <span className="absolute -top-2 left-2 rounded bg-gold px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-kavach-black">
                        BEST
                      </span>
                    ) : null}
                    <div className="font-rajdhani text-sm font-semibold text-cream">
                      {p.id === "Single" ? "Single Card" : p.label}
                    </div>
                    <div className="text-[11px] text-cream-soft">{p.cards}</div>
                    <div className="mt-1 font-mono text-base font-bold text-gold">
                      {formatInr(p.price)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <a
            href="#order-form"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-dark to-gold-light py-3.5 font-rajdhani text-base font-bold text-kavach-black animate-[ks-pay-pulse_2.4s_ease-in-out_infinite]"
          >
            <Shield className="h-5 w-5" />
            Pay {formatInr(total)} Securely — fill details below
          </a>
        </motion.div>
      </div>

      {/* Benefits */}
      <motion.section
        aria-labelledby="order-benefits-heading"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45 }}
      >
        <h2
          id="order-benefits-heading"
          className="mb-4 font-rajdhani text-xl font-semibold text-cream"
        >
          Card Benefits / Why KavachSaathi
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {BENEFIT_ITEMS.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex gap-3 rounded-xl border border-gold/15 bg-kavach-black/30 px-3 py-3 text-sm text-cream-soft"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </motion.section>

      {/* Form */}
      <motion.form
        id="order-form"
        onSubmit={submit}
        className="grid gap-3 rounded-2xl border border-gold/25 bg-kavach-s1/80 p-5 sm:grid-cols-2 sm:p-6"
        noValidate
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45 }}
      >
        <div className="mb-1 flex items-center gap-2 sm:col-span-2">
          <MapPin className="h-4 w-4 text-gold" />
          <h2 className="font-rajdhani text-lg font-semibold text-cream">
            Shipping details
          </h2>
        </div>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-cream-soft">
          Name *
          <input
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Your full name"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-cream-soft">
          Phone *
          <input
            name="phone"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            className={inputClass}
            placeholder="10-digit mobile"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-cream-soft sm:col-span-2">
          Email *
          <input
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-cream-soft sm:col-span-2">
          Address line *
          <input
            name="address_line"
            autoComplete="street-address"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            className={inputClass}
            placeholder="House / flat, street, landmark"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-cream-soft">
          City *
          <input
            name="city"
            autoComplete="address-level2"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={inputClass}
            placeholder="City"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-cream-soft">
          State *
          <input
            name="state"
            autoComplete="address-level1"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className={inputClass}
            placeholder="State"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-cream-soft">
          Pincode *
          <input
            name="pincode"
            inputMode="numeric"
            maxLength={6}
            value={pincode}
            onChange={(e) =>
              setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className={inputClass}
            placeholder="6-digit PIN"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-cream-soft">
          Quantity
          <select
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className={inputClass}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>

        <div className="sm:col-span-2 rounded-lg border border-gold/20 bg-kavach-black/40 px-3 py-2 text-sm text-cream-soft">
          Selected:{" "}
          <span className="font-semibold text-cream">
            {pack.id === "Single" ? "Single Card" : pack.label}
          </span>{" "}
          · Qty {qty} · Total{" "}
          <span className="font-mono font-bold text-gold">
            {formatInr(total)}
          </span>{" "}
          · FREE delivery
        </div>

        {err ? (
          <p
            role="alert"
            className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 sm:col-span-2"
          >
            {err}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || !formValid}
          className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-dark to-gold-light py-4 font-rajdhani text-lg font-bold text-kavach-black disabled:cursor-not-allowed disabled:opacity-50 animate-[ks-pay-pulse_2.4s_ease-in-out_infinite] disabled:animate-none"
        >
          {busy ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Opening secure payment…
            </>
          ) : (
            <>
              <Check className="h-5 w-5" />
              Pay {formatInr(total)} Securely
            </>
          )}
        </button>
        <p className="text-center text-xs text-cream-soft sm:col-span-2">
          Secure Razorpay checkout · Card ships after payment — activate after
          delivery. Paid orders are created only after successful verification.
        </p>
      </motion.form>

      <p className="text-center text-xs text-cream-soft">
        Helpline <b className="text-gold">+91 72730 00075</b> ·{" "}
        <b className="text-gold">+91 73001 00102</b>
      </p>
    </div>
  );
}
