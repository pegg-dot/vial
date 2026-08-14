import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ExternalLink, Newspaper } from "lucide-react";
import { getDatabase } from "@/server/db/client";
import { listNews } from "@/server/external/repository";
import { ArtCoa, ArtShieldCheck } from "@/components/vial-art";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/news" },
  title: "Market news & enforcement",
  description: "Sourced news, regulatory actions, and court records shaping the research-peptide market. Every item links to its source and is labeled by how reliable that source is.",
};

// Source-type honesty: government/court/trade records are primary and high-confidence; blogs/forums
// are industry chatter and clearly marked as such so a reader weights them accordingly.
const SOURCE_META: Record<string, { label: string; cls: string; note: string }> = {
  trade: { label: "Official record", cls: "bg-[#e6fbf6] text-[#0e8f80]", note: "Primary government, court, or regulatory document" },
  news: { label: "News", cls: "bg-[#eaf3ff] text-[#2b31d8]", note: "Reported by an established news outlet" },
  blog: { label: "Industry blog", cls: "bg-[#fff6e6] text-[#b26a00]", note: "Industry tracker/blog — not independently verified" },
  forum: { label: "Forum", cls: "bg-[#fff6e6] text-[#b26a00]", note: "Community/forum report — treat as unconfirmed" },
};

export default async function NewsPage() {
  const db = await getDatabase();
  const items = await listNews(db, 80);

  return (
    <>
      <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-[#fff3f1]">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <ArtCoa className="gum-float absolute right-[6%] top-[18%] hidden w-24 drop-shadow-[5px_5px_0_#111214] sm:block lg:w-28" />
          <ArtShieldCheck className="gum-float-slow absolute right-[17%] bottom-[12%] hidden w-16 drop-shadow-[4px_4px_0_#111214] lg:block" />
        </div>
        <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-3xl">
            <span className="ink-1 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-[#d3372c]"><Newspaper className="size-3" /> Market intelligence</span>
            <h1 className="mt-5 text-balance text-[clamp(2.8rem,7vw,5.5rem)] font-extrabold leading-[.9] tracking-[-.05em]">News &amp; <span className="text-[#d3372c]">enforcement.</span></h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[#111214]/70">The regulatory actions, lawsuits, and industry shifts moving the research-peptide market. Every item links to its source and is tagged by how much weight it deserves — a primary FDA or court document is not the same as a forum rumor, and we mark which is which.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 sm:py-16">
        {items.length === 0 ? (
          <p className="ink rounded-[20px] bg-white px-6 py-16 text-center text-sm font-medium text-[var(--muted)]">No news on record yet.</p>
        ) : (
          <ol className="space-y-3">
            {items.map((n) => {
              const meta = SOURCE_META[n.source_type] ?? SOURCE_META.news;
              return (
                <li key={n.id} className="ink-1 hard rounded-[18px] bg-white p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`ink-1 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
                    {n.news_date && <span className="text-[11px] font-bold tabular-nums text-[var(--muted)]">{n.news_date}</span>}
                    {n.publisher && <span className="text-[11px] font-semibold text-[var(--muted)]">· {n.publisher}</span>}
                    {n.vendor_slug && (
                      <Link href={`/vendors/${n.vendor_slug}`} className="ink-1 ml-auto inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#111214] transition hover:-translate-y-0.5">
                        {n.vendor_name ?? n.vendor_slug} <ArrowUpRight className="size-3" />
                      </Link>
                    )}
                  </div>
                  <h2 className="mt-3 text-xl font-extrabold leading-6 tracking-[-.02em]">{n.title}</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-black/70">{n.summary}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold text-[var(--muted)]">{meta.note}</span>
                    <a href={n.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-black/45 hover:text-black">source <ExternalLink className="size-3" /></a>
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
