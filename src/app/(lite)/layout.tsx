import type { Metadata, Viewport } from "next";

/**
 * Emergency / card scan root — no globals.css, no Google fonts, no nav/auth.
 * Keeps first paint tiny for Slow-4G Lighthouse targets.
 */
export const metadata: Metadata = {
  title: "KavachSaathi Card",
  description: "Emergency medical profile — KavachSaathi",
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0812",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "light",
};

export default function LiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#FAFAF7",
          color: "#0B0812",
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Devanagari", Helvetica, Arial, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
