import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://kavachsaathi.in";

  const paths = [
    "",
    "/pricing",
    "/order",
    "/terms",
    "/privacy",
    "/refund-policy",
    "/shipping-policy",
    "/contact",
  ];

  return paths.map((path, i) => ({
    url: `${site}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : Math.max(0.5, 0.9 - i * 0.05),
  }));
}
