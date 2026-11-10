import { ArrowUpRight, Newspaper } from "lucide-react";
import type { NewsItem } from "@/server/external/repository";
import { SOURCE_META, classifyNewsTopics } from "@/lib/news-filter";
import { hidesCommerce } from "@/lib/public-research-release";
import { Chip, NumberedSection, Pill, Quiet, UI, type Tone } from "@/components/intelligence/research-ui";

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
// name the publisher, and link out. `number` is the section's place in the report, handed down by
// the page so the frame and the jump-nav agree.

// The source-type weight as a kit tone: a primary document is a recorded fact (mint), press is a
// source we cite (blue), a tracker or forum post is unconfirmed (warn).
const SOURCE_TONE: Record<string, Tone> = { trade: "mint", news: "blue", blog: "warn", forum: "warn" };

export function VendorNewsPanel({ items, vendorName, vendorSlug, number }: { items: NewsItem[]; vendorName: string; vendorSlug: string; number: number }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 6);
  // The site-wide feed is closed under the evidence-only release, so the way into it goes too.
  const feedOpen = !hidesCommerce();
  return (
    <NumberedSection id="news" number={number} eyebrow="In the news" title={`Has anything been written about ${vendorName}?`}
      intro={<>{items.length} record{items.length === 1 ? "" : "s"} on file that name{items.length === 1 ? "s" : ""} this vendor{shown.length < items.length ? `, newest ${shown.length} shown` : ""}. Each is tagged by how much weight it deserves &mdash; a court document is not a forum post &mdash; and links to its own source. Coverage is not a verdict either way.</>}
      actions={feedOpen ? <Pill href={`/news?q=${encodeURIComponent(vendorSlug)}`} size="sm" arrow="right">All news for {vendorName}</Pill> : undefined}>
      <ul className="grid gap-3 lg:grid-cols-2">
        {shown.map((item) => {
          const meta = SOURCE_META[item.source_type] ?? SOURCE_META.news;
          const topics = classifyNewsTopics(item);
          return (
            <Quiet key={item.id} as="li" className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span title={meta.note}><Chip tone={SOURCE_TONE[item.source_type] ?? "blue"}>{meta.label}</Chip></span>
                {item.publisher && <span className="text-[11px] font-bold text-[var(--muted)]">{item.publisher}</span>}
                {item.news_date && <span className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">{item.news_date}</span>}
              </div>
              <h3 className={UI.h4 + " leading-6"}>{item.title}</h3>
              <p className={UI.bodyInk}>{item.summary}</p>
              {topics.length > 0 && (
                <p className={UI.eyebrowMuted} title="Grouped from the headline and summary by VialGrade — not a label the publisher applied">
                  {topics.join(" · ")}
                </p>
              )}
              <a href={item.source_url} target="_blank" rel="noopener noreferrer nofollow" className={UI.linkSmall + " mt-auto"}>
                <Newspaper className="size-3.5" aria-hidden="true" /> Source <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
            </Quiet>
          );
        })}
      </ul>
    </NumberedSection>
  );
}
