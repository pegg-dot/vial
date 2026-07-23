import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Newspaper } from "lucide-react";
import { getDatabase } from "@/server/db/client";
import { listNews } from "@/server/external/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Market news & enforcement",
  description: "Sourced news, regulatory actions, and court records shaping the research-peptide market. Every item links to its source and is labeled by how reliable that source is.",
};

// Source-type honesty: government/court/trade records are primary and high-confidence; blogs/forums
// are industry chatter and clearly marked as such so a reader weights them accordingly.
const SOURCE_META: Record<string, { label: string; cls: string; note: string }> = {
  trade: { label: "Official record", cls: "bg-emerald-50 text-emerald-700", note: "Primary government, court, or regulatory document" },
  news: { label: "News", cls: "bg-sky-50 text-sky-700", note: "Reported by an established news outlet" },
  blog: { label: "Industry blog", cls: "bg-amber-50 text-amber-800", note: "Industry tracker/blog — not independently verified" },
  forum: { label: "Forum", cls: "bg-amber-50 text-amber-800", note: "Community/forum report — treat as unconfirmed" },
};

export default async function NewsPage() {
  const db = await getDatabase();
  const items = await listNews(db, 80);

  return (
    <>
      <section className="border-b border-black/[.06]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-16">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700"><Newspaper className="size-3" /> Market intelligence</span>
            <h1 className="mt-5 text-5xl font-semibold leading-[.95] tracking-[-.06em] sm:text-6xl">News &amp; enforcement</h1>
            <p className="mt-6 text-base leading-7 text-[var(--muted)] sm:text-lg">The regulatory actions, lawsuits, and industry shifts moving the research-peptide market. Every item links to its source and is tagged by how much weight it deserves — a primary FDA or court document is not the same as a forum rumor, and we mark which is which.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 sm:py-16">
        {items.length === 0 ? (
          <p className="rounded-[24px] border border-dashed border-black/15 bg-white/55 px-6 py-16 text-center text-sm text-[var(--muted)]">No news on record yet.</p>
        ) : (
          <ol className="space-y-3">
            {items.map((n) => {
              const meta = SOURCE_META[n.source_type] ?? SOURCE_META.news;
              return (
                <li key={n.id} className="rounded-[24px] border border-black/[.07] bg-white p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>
                    {n.news_date && <span className="text-[11px] font-medium tabular-nums text-[var(--muted)]">{n.news_date}</span>}
                    {n.publisher && <span className="text-[11px] text-[var(--muted)]">· {n.publisher}</span>}
                    {n.vendor_slug && (
                      <Link href={`/vendors/${n.vendor_slug}`} className="ml-auto inline-flex items-center rounded-full bg-black/[.045] px-2.5 py-1 text-[11px] font-semibold text-black/60 hover:bg-black/[.08]">
                        {n.vendor_name ?? n.vendor_slug} →
                      </Link>
                    )}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold leading-6 tracking-[-.02em]">{n.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-black/70">{n.summary}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-[var(--muted)]">{meta.note}</span>
                    <a href={n.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-black/45 hover:text-black">source <ExternalLink className="size-3" /></a>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
