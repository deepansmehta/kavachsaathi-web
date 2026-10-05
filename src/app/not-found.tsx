export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#080808",
        color: "#F0EEE8",
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
        <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Page not found</h1>
        <p style={{ color: "#A8A59C", marginBottom: 24 }}>
          The link may be wrong or the page was moved.
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "12px 20px",
            borderRadius: 10,
            background: "linear-gradient(135deg,#FCE49A,#D4AF37,#B8860B)",
            color: "#0a0a08",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Go home
        </a>
      </div>
    </main>
  );
}
