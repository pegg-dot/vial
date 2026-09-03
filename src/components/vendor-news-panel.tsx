import Link from "next/link";
import { ArrowUpRight, ExternalLink, Newspaper } from "lucide-react";
import type { NewsItem } from "@/server/external/repository";
import { SOURCE_META, classifyNewsTopics } from "@/lib/news-filter";

// What has been written about THIS vendor.
//
// `getVendorNews` existed, was indexed for, and had no caller: news items carrying a vendor_slug
// were readable only through the site-wide /news feed, where a reader had to already know to
// search for the company they were standing on. The vendor report answers "has any regulator acted
// against them", "what do buyers say", "who owns it" — "has anyone written about them" belongs in
// the same row of questions.
//
// Each item keeps its source-type weight (the same table /news uses) because a forum rumour and a
// court filing are not the same evidence, and the panel never editorialises: we show the record,
// name the publisher, and link out.
export function VendorNewsPanel({ items, vendorName, vendorSlug }: { items: NewsItem[]; vendorName: string; vendorSlug: string }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 6);
  return (
    <section id="news" className="mx-auto max-w-[1320px] scroll-mt-[140px] px-5 pt-8 sm:px-8 sm:pt-10">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">In the news</p>
          <h2 className="mt-2 text-xl font-extrabold tracking-[-.03em] sm:text-2xl">Has anything been written about {vendorName}?</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">
            {items.length} record{items.length === 1 ? "" : "s"} on file that name{items.length === 1 ? "s" : ""} this vendor{shown.length < items.length ? `, newest ${shown.length} shown` : ""}. Each is tagged by how much weight it deserves &mdash; a court document is not a forum post &mdash; and links to its own source. Coverage is not a verdict either way.
          </p>
        </div>
        <Link href={`/news?q=${encodeURIComponent(vendorSlug)}`} className="ink hard-sm press inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#111214]">
          All news for {vendorName} <ArrowUpRight className="size-4" />
        </Link>
      </div>
      <ul className="grid gap-3 lg:grid-cols-2">
        {shown.map((item) => {
          const meta = SOURCE_META[item.source_type] ?? SOURCE_META.news;
          const topics = classifyNewsTopics(item);
          return (
            <li key={item.id} className="ink-1 hard flex flex-col gap-2.5 rounded-[18px] bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`ink-1 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.cls}`} title={meta.note}>{meta.label}</span>
                {item.publisher && <span className="text-[11px] font-bold text-[var(--muted)]">{item.publisher}</span>}
                {item.news_date && <span className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">{item.news_date}</span>}
              </div>
              <h3 className="text-base font-extrabold leading-6 tracking-[-.02em]">{item.title}</h3>
              <p className="text-sm font-medium leading-6 text-black/70">{item.summary}</p>
              {topics.length > 0 && (
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]" title="Grouped from the headline and summary by VialGrade — not a label the publisher applied">
                  {topics.join(" · ")}
                </p>
              )}
              <a href={item.source_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-black/45 hover:text-black">
                <Newspaper className="size-3" /> source <ExternalLink className="size-3" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
