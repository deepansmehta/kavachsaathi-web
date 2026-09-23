import type { Metadata, Viewport } from "next";
import { Rajdhani, DM_Sans, Space_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/contexts/AuthContext";
import { Providers } from "@/components/Providers";
import "@/styles/globals.css";

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-rajdhani",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-dm-sans",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KavachSaathi — India Ka Pehla Smart Health Card",
    template: "%s | KavachSaathi",
  },
  description:
    "India's first smart PVC health card. Instant emergency medical access in 3 seconds. No app. No login. Just scan.",
  applicationName: "KavachSaathi",
  authors: [{ name: "GDM Technoworld Pvt. Ltd." }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KavachSaathi",
  },
};

export const viewport: Viewport = {
  themeColor: "#D4AF37",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${rajdhani.variable} ${dmSans.variable} ${spaceMono.variable} dark`}
    >
      <body className="min-h-screen bg-kavach-black font-body text-cream antialiased">
        <AuthProvider>
          <Providers>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  background: "#1A1A1A",
                  color: "#E6DFC8",
                  border: "1px solid rgba(212,175,55,0.22)",
                  fontFamily: "DM Sans, sans-serif",
                },
                success: { iconTheme: { primary: "#D4AF37", secondary: "#080808" } },
              }}
            />
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
