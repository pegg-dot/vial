import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { getCatalogSnapshot } from "@/server/catalog/repository";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { compounds, products, vendors } = await getCatalogSnapshot();
  const now = new Date();
  const pages = [
    ["", "weekly", 1], ["/market","daily",.9], ["/search","daily",.85], ["/compounds","weekly",.8], ["/vendors","weekly",.8],
    ["/research","weekly",.75], ["/passports","daily",.8], ["/labs","weekly",.75], ["/testing","weekly",.7], ["/compare","weekly",.6], ["/how-we-check","monthly",.7], ["/grades","monthly",.7], ["/reference-standard","monthly",.6],
    ["/signals","daily",.65], ["/about","monthly",.5], ["/help","monthly",.5],
    ["/status","daily",.4], ["/legal/privacy","yearly",.2], ["/legal/terms","yearly",.2], ["/legal/disclaimer","yearly",.3],
  ] as const;
  return [
    ...pages.map(([path,changeFrequency,priority])=>({url:`${siteUrl}${path}`,lastModified:now,changeFrequency,priority})),
    ...products.map(product=>({url:`${siteUrl}/products/${product.slug}`,lastModified:now,changeFrequency:"daily" as const,priority:.8})),
    ...compounds.map(compound=>({url:`${siteUrl}/compounds/${compound.slug}`,lastModified:now,changeFrequency:"weekly" as const,priority:.75})),
    ...vendors.map(vendor=>({url:`${siteUrl}/vendors/${vendor.slug}`,lastModified:now,changeFrequency:"weekly" as const,priority:.7})),
  ];
}
