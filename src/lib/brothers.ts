/**
 * Bajaj Brothers — eldest → youngest.
 * Used on coming-soon, home dedication, and SEO metadata.
 */
export const BROTHERS = [
  {
    name: "Shri Gangadhar Bajaj Ji",
    shortName: "Gangadhar Bajaj",
    label: "The Eldest · Our Grandfather",
    memorial: true,
    years: "1949 — 2011",
    variant: "memorial" as const,
  },
  {
    name: "Shri Bansi Dhar Bajaj Ji",
    shortName: "Bansi Dhar Bajaj",
    label: "The Pillar of Our Family",
    memorial: false,
    variant: "pillar" as const,
  },
  {
    name: "Shri Surender Bajaj Ji",
    shortName: "Surender Bajaj",
    label: "The Pillar of Our Family",
    memorial: false,
    variant: "pillar" as const,
  },
  {
    name: "Shri Narender Bajaj Ji",
    shortName: "Narender Bajaj",
    label: "The Pillar of Our Family",
    memorial: false,
    variant: "pillar" as const,
  },
  {
    name: "Shri Pawan Bajaj Ji",
    shortName: "Pawan Bajaj",
    label: "The Youngest · In Loving Memory",
    memorial: true,
    years: "1962 — 2015",
    variant: "memorial" as const,
  },
] as const;

export type Brother = (typeof BROTHERS)[number];

export const BROTHERS_DEDICATION_LINE = BROTHERS.map((b) =>
  "years" in b && b.years
    ? `${b.name} (${b.years.replace(/ — /g, " to ")})`
    : b.name
).join(", ");

export const BROTHERS_MEMORIAL_LINE =
  "In loving memory of Shri Gangadhar Bajaj Ji (1949–2011) and Shri Pawan Bajaj Ji (1962–2015).";
