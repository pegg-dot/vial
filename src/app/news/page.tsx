import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { getDatabase } from "@/server/db/client";
import { listNews } from "@/server/external/repository";
import { ArtCoa, ArtShieldCheck } from "@/components/vial-art";
import { DataUnavailable } from "@/components/home-data-unavailable";
import { NewsFeed } from "@/components/news-feed";
import { NEWS_TOPICS, type NewsTopicId } from "@/lib/news-filter";
import { reportError } from "@/server/observability/alerts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/news" },
  title: "Market news & enforcement",
  description: "Sourced news, regulatory actions, and court records shaping the research-peptide market. Every item links to its source and is labeled by how reliable that source is.",
};

const SOURCE_TYPES = new Set(["trade", "news", "blog", "forum"]);
const TOPIC_IDS = new Set<string>(NEWS_TOPICS.map((topic) => topic.id));

/** searchParams are attacker-controlled. Seed the client only with values it could have produced. */
function asList(value: string | string[] | undefined, allowed: Set<string>) {
  const raw = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return Array.from(new Set(raw.filter((item) => allowed.has(item))));
}

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ q?: string; source?: string | string[]; topic?: string | string[] }> }) {
  const [params, items] = await Promise.all([
    searchParams,
    getDatabase().then((db) => listNews(db, 200)).catch((error) => {
      reportError({ kind: "news-unavailable", message: "The news feed could not be read.", context: { error: String(error) } });
      return null;
    }),
  ]);
  if (!items) return <DataUnavailable surface="the news feed" />;

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

      <section className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 sm:py-10">
        {items.length === 0 ? (
          <p className="ink rounded-[20px] bg-white px-6 py-16 text-center text-sm font-medium text-[var(--muted)]">No news on record yet.</p>
        ) : (
          <NewsFeed
            items={items}
            initialQuery={typeof params.q === "string" ? params.q.slice(0, 120) : ""}
            initialSourceTypes={asList(params.source, SOURCE_TYPES)}
            initialTopics={asList(params.topic, TOPIC_IDS) as NewsTopicId[]}
          />
        )}
      </section>
    </>
  );
}
