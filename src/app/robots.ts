import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://kavachsaathi.in";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/coming-soon"],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
