"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type PassPayload = {
  watermark?: string;
  full_name?: string;
  blood_group?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  medications?: string[];
  emergency_contacts?: { name?: string; phone?: string }[];
  includeIds?: boolean;
  idProofs?: unknown;
  error?: string;
};

export default function AttendantPassPage() {
  const params = useParams();
  const token = String(params?.token || "");
  const [data, setData] = useState<PassPayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "gone" | "err">(
    "loading"
  );

  useEffect(() => {
    if (!token) return;
    fetch(`/api/pass/${token}`)
      .then(async (r) => {
        const j = await r.json();
        if (r.status === 410) {
          setStatus("gone");
          setData(j);
          return;
        }
        if (!r.ok) {
          setStatus("err");
          setData(j);
          return;
        }
        setData(j);
        setStatus("ok");
      })
      .catch(() => setStatus("err"));
  }, [token]);

  if (status === "loading") {
    return <main className="p-6 text-center text-stone-300">Loading pass…</main>;
  }
  if (status === "gone") {
    return (
      <main className="mx-auto max-w-md p-6 text-center text-stone-300">
        <h1 className="text-xl text-red-400">Pass expired or revoked</h1>
        <p className="mt-2 text-sm">{data?.error || "410"}</p>
      </main>
    );
  }
  if (status === "err" || !data) {
    return (
      <main className="p-6 text-center text-stone-300">
        Unable to open attendant pass.
      </main>
    );
  }

  return (
    <main className="relative mx-auto min-h-screen max-w-md bg-[#0c0c0a] px-4 py-6 text-[#F0EEE8]">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
        <p className="rotate-[-28deg] text-center text-2xl font-bold text-[#D4AF37]">
          {data.watermark}
        </p>
      </div>
      <h1 className="relative text-xl font-bold text-[#D4AF37]">Attendant pass</h1>
      <p className="relative mt-1 text-xs text-[#A8A59C]">{data.watermark}</p>
      <section className="relative mt-6 space-y-3 rounded-xl border border-[#D4AF37]/30 bg-[#141410] p-4">
        <p className="text-2xl font-semibold">{data.full_name}</p>
        <p>
          Blood group: <strong>{data.blood_group}</strong>
        </p>
        <p>Allergies: {(data.allergies || []).join(", ") || "—"}</p>
        <p>Conditions: {(data.chronic_conditions || []).join(", ") || "—"}</p>
        <p>Medicines: {(data.medications || []).join(", ") || "—"}</p>
        <div>
          <p className="text-sm text-[#A8A59C]">Emergency contacts</p>
          <ul className="mt-1 text-sm">
            {(data.emergency_contacts || []).map((c, i) => (
              <li key={i}>
                {c.name} · {c.phone}
              </li>
            ))}
          </ul>
        </div>
        {data.includeIds && data.idProofs ? (
          <p className="text-xs text-amber-200">ID images included by owner.</p>
        ) : (
          <p className="text-xs text-[#A8A59C]">ID images not included.</p>
        )}
      </section>
    </main>
  );
}
