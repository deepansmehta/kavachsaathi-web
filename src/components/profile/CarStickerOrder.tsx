"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type OrderRow = {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  qty: number;
  phone: string;
  status: string;
  createdAt: string;
};

type Props = {
  healthId: string;
  defaultPhone: string;
  defaultAddress: string;
};

export function CarStickerOrder({
  healthId,
  defaultPhone,
  defaultAddress,
}: Props) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<"car" | "bike" | "other">(
    "car"
  );
  const [qty, setQty] = useState(1);
  const [address, setAddress] = useState(defaultAddress);
  const [phone, setPhone] = useState(defaultPhone);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setAddress(defaultAddress);
    setPhone(defaultPhone);
  }, [defaultAddress, defaultPhone]);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/profile/sticker-orders");
      if (!r.ok) return;
      const j = await r.json();
      setOrders(j.orders || []);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    setSubmitted(false);
    try {
      const r = await fetch("/api/profile/sticker-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleNumber,
          vehicleType,
          qty,
          address,
          phone,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Could not place order");
        return;
      }
      setSubmitted(true);
      setVehicleNumber("");
      toast.success(j.messageEn || "Order received");
      void load();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="space-y-3 rounded-xl border border-[var(--gold-border)] p-4"
      data-testid="car-sticker-order"
    >
      <p className="font-rajdhani text-sm font-bold uppercase tracking-wider text-[var(--gold)]">
        Order Car Sticker / कार स्टिकर ऑर्डर करें
      </p>
      <p className="text-xs text-[var(--text-soft)]">
        We print and ship your emergency QR sticker after a confirmation call.
        No self-download — {healthId}.
      </p>

      <label className="block text-xs text-[var(--text-soft)]">
        Vehicle number
        <input
          value={vehicleNumber}
          onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
          className="mt-1 w-full rounded-lg border border-[var(--gold-border)] bg-black/40 px-3 py-2 text-sm text-[var(--cream)]"
          maxLength={20}
        />
      </label>

      <label className="block text-xs text-[var(--text-soft)]">
        Vehicle type
        <select
          value={vehicleType}
          onChange={(e) =>
            setVehicleType(e.target.value as "car" | "bike" | "other")
          }
          className="mt-1 w-full rounded-lg border border-[var(--gold-border)] bg-black/40 px-3 py-2 text-sm"
        >
          <option value="car">Car</option>
          <option value="bike">Bike</option>
          <option value="other">Other</option>
        </select>
      </label>

      <label className="block text-xs text-[var(--text-soft)]">
        Quantity (1–3)
        <input
          type="number"
          min={1}
          max={3}
          value={qty}
          onChange={(e) =>
            setQty(Math.min(3, Math.max(1, Number(e.target.value) || 1)))
          }
          className="mt-1 w-full rounded-lg border border-[var(--gold-border)] bg-black/40 px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-xs text-[var(--text-soft)]">
        Delivery address
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-[var(--gold-border)] bg-black/40 px-3 py-2 text-sm text-[var(--cream)]"
        />
      </label>

      <label className="block text-xs text-[var(--text-soft)]">
        Phone
        <input
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--gold-border)] bg-black/40 px-3 py-2 text-sm"
        />
      </label>

      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="w-full rounded-lg border border-[var(--gold)] px-3 py-2 text-sm text-[var(--gold)]"
      >
        {busy ? "Submitting…" : "Submit order / ऑर्डर भेजें"}
      </button>

      {submitted ? (
        <p className="rounded-lg bg-[var(--gold-faint,#2a2410)] px-3 py-2 text-sm text-[var(--gold)]">
          Order received. Our team will call you to confirm. / ऑर्डर मिल गया,
          हमारी टीम आपको कॉल करेगी।
        </p>
      ) : null}

      {orders.length > 0 ? (
        <div className="space-y-2 border-t border-[var(--gold-border)] pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold)]">
            Your orders
          </p>
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-lg border border-[var(--gold-border)] p-2 text-xs"
            >
              <p className="text-[var(--cream)]">
                {o.vehicleNumber} · {o.vehicleType} · qty {o.qty}
              </p>
              <p className="text-[var(--text-soft)]">
                Status: <span className="text-[var(--gold)]">{o.status}</span> ·{" "}
                {o.createdAt?.slice(0, 10)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
