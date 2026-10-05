/**
 * Yellow banner shown on every page while ks_launch_sim cookie is active
 * (preview builds only — server reads httpOnly cookie / middleware header).
 */
export function LaunchSimBanner({ opensAtMs }: { opensAtMs: number }) {
  void opensAtMs;
  return (
    <div
      role="status"
      data-testid="launch-sim-banner"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 9999,
        width: "100%",
        background: "#F5C518",
        color: "#1a1a00",
        textAlign: "center",
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: "0.04em",
        padding: "8px 12px",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      TEST MODE — simulated launch
    </div>
  );
}
