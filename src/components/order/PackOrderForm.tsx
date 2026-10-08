"use client";

import { useState } from "react";
import { LAUNCH_PACKS } from "@/lib/launchReveal";

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

export function PackOrderForm({ source = "order_page" }: { source?: string }) {
  const [sel, setSel] = useState({
    p: LAUNCH_PACKS[0].id,
    v: LAUNCH_PACKS[0].price,
  });
  const [qty, setQty] = useState(1);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<{
    token: string;
    question: string;
  } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setOk("");
    const form = e.target as HTMLFormElement;
    const name = (
      form.querySelector("[name=name]") as HTMLInputElement
    ).value.trim();
    const phone = (
      form.querySelector("[name=phone]") as HTMLInputElement
    ).value.trim();
    const address = (
      form.querySelector("[name=address]") as HTMLTextAreaElement
    ).value.trim();
    const miss: string[] = [];
    if (!name) miss.push("name / नाम");
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").slice(-10)))
      miss.push("valid mobile / सही मोबाइल");
    if (address.length < 10) miss.push("full address + PIN / पूरा पता");
    if (miss.length) {
      setErr("Please add " + miss.join(", ") + ".");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          address,
          pack: sel.p,
          quantity: qty,
          source,
          captchaToken: captcha?.token,
          captchaAnswer: captchaAnswer || undefined,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        orderNo?: string;
        message?: string;
        code?: string;
        captcha?: { token: string; question: string };
      };
      if (j.code === "CAPTCHA_REQUIRED" && j.captcha) {
        setCaptcha(j.captcha);
        setCaptchaAnswer("");
        setErr("Please solve the captcha. / कैप्चा हल करें।");
        return;
      }
      if (!r.ok || !j.ok) {
        setErr(j.error || "Could not place order.");
        return;
      }
      setOk(
        j.message ||
          `Order received (${j.orderNo}). Our team will call you to confirm payment and delivery.`
      );
      setCaptcha(null);
      form.reset();
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {LAUNCH_PACKS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSel({ p: p.id, v: p.price })}
            aria-pressed={sel.p === p.id}
            className={`relative rounded-xl border p-3 text-left transition ${
              sel.p === p.id
                ? "border-gold bg-gold/10"
                : "border-gold/25 bg-kavach-s1/80"
            } ${p.best ? "border-gold" : ""}`}
          >
            {p.best ? (
              <span className="absolute -top-2 left-2 rounded bg-gold px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-kavach-black">
                BEST VALUE
              </span>
            ) : null}
            <div className="font-rajdhani text-sm font-semibold text-cream">
              {p.label}
            </div>
            <div className="text-xs text-cream-soft">{p.cards}</div>
            <div className="mt-1 font-mono text-lg font-bold text-gold">
              {fmt(p.price)}
            </div>
            {p.save > 0 ? (
              <div className="text-[11px] text-emerald-400">Save ₹{p.save}</div>
            ) : (
              <div className="text-[11px]">&nbsp;</div>
            )}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-cream-soft">
          Name / नाम
          <input
            name="name"
            autoComplete="name"
            className="rounded-lg border border-gold/25 bg-kavach-s1 px-3 py-2.5 text-sm text-cream"
            placeholder="Your full name"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-cream-soft">
          Mobile / मोबाइल
          <input
            name="phone"
            inputMode="numeric"
            maxLength={10}
            className="rounded-lg border border-gold/25 bg-kavach-s1 px-3 py-2.5 text-sm text-cream"
            placeholder="10-digit mobile"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-cream-soft sm:col-span-2">
          Delivery address + PIN / पता + पिन
          <textarea
            name="address"
            rows={3}
            className="rounded-lg border border-gold/25 bg-kavach-s1 px-3 py-2.5 text-sm text-cream"
            placeholder="House, street, city, PIN code"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-cream-soft">
          Selected pack
          <input
            readOnly
            value={`${sel.p} · ${fmt(sel.v)}`}
            className="rounded-lg border border-gold/25 bg-kavach-s1 px-3 py-2.5 text-sm text-cream"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-cream-soft">
          Quantity
          <select
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="rounded-lg border border-gold/25 bg-kavach-s1 px-3 py-2.5 text-sm text-cream"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
        {captcha ? (
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-cream-soft sm:col-span-2">
            {captcha.question}
            <input
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              inputMode="numeric"
              className="rounded-lg border border-gold/25 bg-kavach-s1 px-3 py-2.5 text-sm text-cream"
              placeholder="Answer"
            />
          </label>
        ) : null}
        {err ? (
          <p className="text-sm text-red-300 sm:col-span-2">{err}</p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="sm:col-span-2 rounded-xl bg-gradient-to-r from-gold-dark to-gold-light py-3.5 font-rajdhani text-base font-bold text-kavach-black disabled:opacity-60"
        >
          {busy ? "Sending…" : `Order now · ${fmt(sel.v * qty)}`}
        </button>
        {ok ? (
          <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-cream sm:col-span-2">
            {ok}
          </p>
        ) : null}
      </form>
      <p className="mt-4 text-center text-xs text-cream-soft">
        Helpline <b className="text-gold">+91 72730 00075</b> ·{" "}
        <b className="text-gold">+91 73001 00102</b>
      </p>
    </div>
  );
}
