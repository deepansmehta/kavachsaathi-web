/** @type {import("next").NextConfig} */
import withPWAInit from "next-pwa";

/**
 * F55 — Cache ONLY app shell (static JS/CSS/fonts/icons) + /offline.
 * NEVER cache /api/*, /card/*, /emergency/*, /e/* (bystander scans leave no data).
 */
const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
  navigateFallbackDenylist: [
    /^\/api\//,
    /^\/card\//,
    /^\/emergency\//,
    /^\/e\//,
    /^\/admin\//,
    /^\/hospital\//,
  ],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-webfonts",
        expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "google-fonts-stylesheets",
        expiration: { maxEntries: 4, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2)$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "static-font-assets",
        expiration: { maxEntries: 16, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/icons\/.+\.(?:png|svg|ico|webp)$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "static-icon-assets",
        expiration: { maxEntries: 32, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.+\.(?:js|css)$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "next-static",
        expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: ({ url }) => {
        if (url.origin !== self.location?.origin && typeof self !== "undefined") {
          // cross-origin handled below as NetworkOnly
        }
        const p = url.pathname;
        // Explicit deny — never cache API or other people's card pages
        if (
          p.startsWith("/api/") ||
          p.startsWith("/card/") ||
          p.startsWith("/emergency/") ||
          p.startsWith("/e/")
        ) {
          return true;
        }
        return false;
      },
      handler: "NetworkOnly",
      options: { cacheName: "never-card-or-api" },
    },
    {
      urlPattern: ({ request, url }) => {
        const p = url.pathname;
        if (
          p.startsWith("/api/") ||
          p.startsWith("/card/") ||
          p.startsWith("/emergency/") ||
          p.startsWith("/e/")
        ) {
          return false;
        }
        // Only cache same-origin GET for static-ish paths; documents use network
        return (
          request.method === "GET" &&
          (p === "/offline" ||
            p === "/manifest.json" ||
            p.startsWith("/_next/static/") ||
            p.startsWith("/icons/") ||
            p.startsWith("/fonts/"))
        );
      },
      handler: "NetworkFirst",
      options: {
        cacheName: "app-shell",
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  // PRELAUNCH_PREVIEW_SECRET: do NOT bake via env{} with || "" — an empty local
  // build would override Netlify runtime. Next Edge inlines process.env at build;
  // Netlify production builds (or CLI with remote env) must supply it.
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },
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
