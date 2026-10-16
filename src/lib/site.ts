export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://vialgrade.example").replace(/\/$/, "");

export const siteConfig = {
  name: "VialGrade",
  title: "VialGrade — Peptide research and evidence records",
  description:
    "Public laboratory reports, documented vendor histories and dated marketplace observations, with sources and limitations shown.",
  url: siteUrl,
} as const;
