/** @type {import("next").NextConfig} */
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },
  // Next 14: keep pdf-lib / fontkit external so .create survives bundling
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
    serverComponentsExternalPackages: ["pdf-lib", "@pdf-lib/fontkit"],
    outputFileTracingIncludes: {
      "/api/forms/**/*": ["./src/lib/fonts/**/*", "./public/fonts/**/*"],
      "/api/forms/cashless": ["./src/lib/fonts/**/*", "./public/fonts/**/*"],
      "/api/forms/admission-sheet": [
        "./src/lib/fonts/**/*",
        "./public/fonts/**/*",
      ],
    },
  },
};

export default withPWA(nextConfig);
