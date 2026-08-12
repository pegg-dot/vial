export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://vialgrade.example").replace(/\/$/, "");

export const siteConfig = {
  name: "VialGrade",
  title: "VialGrade — The peptide market, made legible",
  description:
    "An evidence-first prototype for comparing peptide research listings, vendor histories, pricing, and public documentation.",
  url: siteUrl,
} as const;
