import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VialGrade Market Intelligence",
    short_name: "VialGrade",
    description: "Evidence-first peptide market intelligence.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f4",
    theme_color: "#111214",
    icons: [
      { src: "/brand/vialgrade-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
