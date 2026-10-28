"use client";

import { useState } from "react";
import { COMPANY } from "@/lib/pricing";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(
      `KavachSaathi contact — ${name.trim() || "Customer"}`
    );
    const body = encodeURIComponent(
      `Name: ${name.trim()}\nEmail: ${email.trim()}\n\n${message.trim()}`
    );
    window.location.href = `mailto:${COMPANY.email}?subject=${subject}&body=${body}`;
  };

  return (
    <form onSubmit={submit} className="mt-4 grid max-w-lg gap-3">
      <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-[#A8A59C]">
        Name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-[#D4AF37]/30 bg-[#141410] px-3 py-2.5 text-sm text-cream"
          placeholder="Your name"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-[#A8A59C]">
        Email
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-[#D4AF37]/30 bg-[#141410] px-3 py-2.5 text-sm text-cream"
          placeholder="you@example.com"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-[#A8A59C]">
        Message
        <textarea
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="rounded-lg border border-[#D4AF37]/30 bg-[#141410] px-3 py-2.5 text-sm text-cream"
          placeholder="How can we help?"
        />
      </label>
      <button
        type="submit"
        className="rounded-xl bg-gradient-to-r from-[#B8860B] to-[#D4AF37] py-3 font-rajdhani text-base font-bold text-kavach-black"
      >
        Send via email
      </button>
      <p className="text-xs text-[#A8A59C]">
        Opens your email app to message {COMPANY.email}. Or write us directly.
      </p>
    </form>
  );
}
