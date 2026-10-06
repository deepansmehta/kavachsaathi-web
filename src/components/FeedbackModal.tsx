"use client";

import { useEffect, useState } from "react";

type Props = {
  enabled: boolean;
  context: "activation" | "full_details";
};

/** F52 feedback modal — no health data sent */
export function FeedbackModal({ enabled, context }: Props) {
  const key = `ks_feedback_${context}`;
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [mayContact, setMayContact] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    try {
      if (localStorage.getItem(key) === "1") return;
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [enabled, key]);

  if (!enabled || !open || done) return null;

  const submit = async () => {
    if (stars < 1) return;
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stars,
        comment: comment.slice(0, 500),
        mayContact,
        context,
      }),
    });
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* */
    }
    setDone(true);
    setOpen(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#141410",
          border: "1px solid rgba(212,175,55,0.4)",
          borderRadius: 16,
          padding: 24,
          maxWidth: 360,
          width: "100%",
          color: "#F0EEE8",
        }}
      >
        <h3 style={{ color: "#FCE49A", marginTop: 0 }}>How was your experience?</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStars(n)}
              style={{
                fontSize: 22,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: n <= stars ? "#D4AF37" : "#555",
              }}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          placeholder="Optional comment"
          rows={3}
          style={{
            width: "100%",
            background: "#0c0c0a",
            border: "1px solid #333",
            borderRadius: 8,
            color: "#F0EEE8",
            padding: 8,
          }}
        />
        <label style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={mayContact}
            onChange={(e) => setMayContact(e.target.checked)}
          />
          May we contact you?
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(key, "1");
              } catch {
                /* */
              }
              setOpen(false);
            }}
            style={{ flex: 1, padding: 10, borderRadius: 8 }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={stars < 1}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              background: "#D4AF37",
              color: "#080808",
              fontWeight: 700,
              border: "none",
            }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
