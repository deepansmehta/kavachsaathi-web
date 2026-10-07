"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#080808",
          color: "#F0EEE8",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <p
            style={{
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#D4AF37",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            KavachSaathi
          </p>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#A8A59C", marginBottom: 24 }}>
            Please try again. If the problem continues, email
            gdmtechnoworld@gmail.com.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "12px 20px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg,#FCE49A,#D4AF37,#B8860B)",
              color: "#0a0a08",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
