"use client";

import { useState } from "react";
import { LAUNCH_PACKS } from "@/lib/launchReveal";

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

type Props = {
  /** Rehearsal: submit is demo-only, never saved. */
  rehearsal?: boolean;
  source?: string;
  className?: string;
};

export function OrderForm({
  rehearsal = false,
  source = "web",
  className = "",
}: Props) {
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
          demo: rehearsal || undefined,
          rehearsal: rehearsal || undefined,
          captchaToken: captcha?.token,
          captchaAnswer: captchaAnswer || undefined,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        orderNo?: string;
        message?: string;
        demo?: boolean;
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
        setErr(j.error || "Could not place order. Please try again.");
        return;
      }
      if (j.demo || rehearsal) {
        setOk("Demo — not saved");
        return;
      }
      setOk(
        j.message ||
          `Order received (${j.orderNo}). Our team will call you to confirm payment and delivery.`
      );
      setCaptcha(null);
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <div className="packs" id="packs">
        {LAUNCH_PACKS.map((p) => (
          <button
            key={p.id}
            className={`pack${p.best ? " best" : ""}`}
            type="button"
            aria-pressed={sel.p === p.id}
            onClick={() => setSel({ p: p.id, v: p.price })}
          >
            <span className="pn">{p.label}</span>
            <span className="pc">{p.cards}</span>
            <span className="pr">{fmt(p.price)}</span>
            <span className="pp">
              {p.save > 0 ? `Save ₹${p.save}` : "\u00a0"}
            </span>
          </button>
        ))}
      </div>
      <form id="order" onSubmit={submit} noValidate>
        <label>
          Name / नाम
          <input
            name="name"
            autoComplete="name"
            placeholder="Your full name"
          />
        </label>
        <label>
          Mobile / मोबाइल
          <input
            name="phone"
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile"
          />
        </label>
        <label className="full">
          Delivery address + PIN / पता + पिन
          <textarea
            name="address"
            placeholder="House, street, city, PIN code"
          />
        </label>
        <label>
          Selected pack
          <input readOnly value={`${sel.p} · ${fmt(sel.v)}`} />
        </label>
        <label>
          Quantity
          <select
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
        {captcha ? (
          <label className="full">
            {captcha.question}
            <input
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              inputMode="numeric"
              placeholder="Answer"
            />
          </label>
        ) : null}
        {err ? <div className="err">{err}</div> : null}
        <button className="cta" type="submit" disabled={busy}>
          {busy
            ? "Sending…"
            : rehearsal
              ? `Demo order · ${fmt(sel.v * qty)}`
              : `Order now · ${fmt(sel.v * qty)}`}
        </button>
        {ok ? <div className="ok">{ok}</div> : null}
        {rehearsal ? (
          <p className="help" style={{ gridColumn: "1 / -1" }}>
            Demo — not saved
          </p>
        ) : null}
      </form>
    </div>
  );
}
