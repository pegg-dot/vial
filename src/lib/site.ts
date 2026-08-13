export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://vialgrade.example").replace(/\/$/, "");

export const siteConfig = {
  name: "VialGrade",
  title: "VialGrade — The peptide market, made legible",
  description:
    "Know what's really in the vial. Independent lab tests, prices, and reputation for every peptide vendor — aggregated from public sources and graded on the evidence.",
  url: siteUrl,
} as const;
