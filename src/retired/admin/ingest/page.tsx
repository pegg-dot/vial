import type { Metadata } from "next";
import { Braces, FileInput, ShieldCheck } from "lucide-react";
import { ingestSourceAction } from "../operations-actions";
import { requireStaff } from "@/server/auth/session";
import { getCatalogSnapshot } from "@/server/catalog/repository";

export const metadata: Metadata = { title: "Ingest source" };
export const dynamic = "force-dynamic";
const demoHtml = `<html>
  <head>
    <title>BPC-157 10 mg | Northstar Research</title>
    <script type="application/ld+json">
      {"@type":"Product","name":"BPC-157 10 mg","offers":{"price":"54.00","priceCurrency":"USD","availability":"https://schema.org/InStock"}}
    </script>
  </head>
  <body>
    <h1>BPC-157 10 mg</h1>
    <p>Ships in 2–4 business days.</p>
    <p>Batch: NS-BPC-2407</p>
    <p>Report date: July 11, 2026</p>
    <p>Report issuer: Atlas Analytical</p>
    <p>Report confirmed: yes</p>
  </body>
</html>`;

export default async function IngestPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff();
  const [catalog, params] = await Promise.all([getCatalogSnapshot(), searchParams]);
  return <div>
    <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#2b31d8]">Scout → Clerk → Resolver → Verifier → Auditor</p>
    <h1 className="mt-3 text-4xl font-extrabold tracking-[-.055em] sm:text-5xl">Ingest a source</h1>
    <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">This controlled workflow stores an immutable snapshot, extracts a limited vocabulary of listing claims, compares them with current state, and routes changes to review. It does not crawl autonomously or publish directly.</p>
    {params.error&&<div className="ink-1 mt-6 rounded-[14px] bg-[#fff1f0] px-4 py-3 text-sm font-medium text-[#d3372c]">{decodeURIComponent(params.error)}</div>}
    <form action={ingestSourceAction} className="mt-8 grid gap-6 xl:grid-cols-[1fr_1.35fr]">
      <div className="ink hard space-y-5 rounded-[20px] bg-white p-6">
        <div className="flex items-center gap-3"><span className="ink-1 grid size-10 place-items-center rounded-[12px] bg-[#eef0ff] text-[#2b31d8]"><FileInput className="size-4"/></span><div><h2 className="font-extrabold">Source identity</h2><p className="text-xs font-medium text-[var(--muted)]">Where the observation came from</p></div></div>
        <label className="block"><span className="text-xs font-bold">Source type</span><select name="sourceType" className="field mt-2" defaultValue="vendor-page"><option value="vendor-page">Vendor page</option><option value="lab-report">Lab report</option><option value="policy">Policy page</option><option value="regulatory">Regulatory source</option><option value="manual-note">Manual note</option></select></label>
        <label className="block"><span className="text-xs font-bold">Canonical URL</span><input name="canonicalLocation" type="url" required className="field mt-2" defaultValue="https://example.invalid/catalog/bpc-157-10mg"/></label>
        <label className="block"><span className="text-xs font-bold">Source label</span><input name="label" required className="field mt-2" defaultValue="Northstar Research product page"/></label>
        <label className="block"><span className="text-xs font-bold">Target listing</span><select name="targetListingSlug" required className="field mt-2">{catalog.products.map(product=>{const vendor=catalog.vendors.find(v=>v.slug===product.vendorSlug);return <option key={product.slug} value={product.slug}>{product.name} · {vendor?.name}</option>})}</select></label>
        <label className="block"><span className="text-xs font-bold">Content type</span><select name="contentType" className="field mt-2" defaultValue="text/html"><option value="text/html">HTML</option><option value="application/json">JSON</option><option value="text/plain">Plain text</option></select></label><label className="block"><span className="text-xs font-bold">Parser profile</span><select name="parserProfile" className="field mt-2" defaultValue="catalog"><option value="catalog">Catalog page</option><option value="generic">Generic source</option><option value="jsonld">JSON-LD product</option><option value="document">Evidence document</option></select></label>
        <div className="ink-1 rounded-[12px] bg-[#e6fbf4] p-4 text-xs font-medium leading-5 text-[#0e8f80]"><ShieldCheck className="mb-2 size-4"/>Page content is treated as untrusted data. Instructions embedded inside a page cannot alter the tool loop or its publication permissions.</div>
      </div>
      <div className="ink rounded-[20px] bg-[#111214] p-6 text-white">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[12px] border border-white/25 bg-white/10"><Braces className="size-4"/></span><div><h2 className="font-extrabold">Captured content</h2><p className="text-xs font-medium text-white/50">Paste a saved response, report text, or controlled fixture</p></div></div>
        <textarea name="rawContent" aria-label="Captured content" required className="mt-6 min-h-[500px] w-full resize-y rounded-[14px] border-[1.5px] border-white/25 bg-black/20 p-5 font-mono text-[12px] leading-6 text-white/80 outline-none focus:border-[#8fa2ff] focus:shadow-[3px_3px_0_0_#2b31d8]" defaultValue={demoHtml}/>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-md text-xs font-medium leading-5 text-white/50">Only price, availability, shipping, batch code, report date, report issuer, and report-confirmation statements can be proposed by this first workflow.</p><button className="h-11 shrink-0 rounded-full border-2 border-white bg-white px-5 text-sm font-bold text-[#111214] transition hover:border-[#8fa2ff] hover:bg-[#8fa2ff]">Capture and extract</button></div>
      </div>
    </form>
  </div>;
}
