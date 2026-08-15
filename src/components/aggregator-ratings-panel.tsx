import { ExternalLink, Gauge } from "lucide-react";
import type { AggregatorRating } from "@/server/external/repository";

// What independent third-party aggregators publish about a vendor. Each row is attributed to its
// source and links out — VialGrade reports what the aggregator says, never adopts it as our own verdict.
const SOURCE_LABEL: Record<string, string> = { peptigrity: "Peptigrity", finnrick: "Finnrick", batchguild: "BatchGuild" };

export function AggregatorRatingsPanel({ ratings, vendorName }: { ratings: AggregatorRating[]; vendorName: string }) {
  if (ratings.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1320px] px-5 pt-14 sm:px-8 sm:pt-16">
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Third-party aggregators</p>
        <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold leading-[.98] tracking-[-.04em]">What do other trackers say about {vendorName}?</h2>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">{ratings.length} independent peptide-testing aggregator{ratings.length === 1 ? " has" : "s have"} published a rating for {vendorName}. These are their opinions, not ours — we show them side by side and link to each source so you can check the basis yourself.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {ratings.map((r) => {
          const hasScore = r.score != null && r.max_score != null;
          const pct = hasScore ? Number(r.score) / Number(r.max_score) : null;
          const tone = pct == null ? "neutral" : pct >= 0.75 ? "good" : pct >= 0.5 ? "mid" : "low";
          const toneCls = { good: "text-[#0e8f80] bg-[#e6fbf6]", mid: "text-[#b26a00] bg-[#fff6e6]", low: "text-[#d3372c] bg-[#ffecea]", neutral: "text-black/55 bg-black/[.05]" }[tone];
          return (
            <a key={`${r.source}-${r.vendor_slug}`} href={r.source_url} target="_blank" rel="noopener noreferrer nofollow"
              className="ink-1 hard press group flex flex-col gap-3 rounded-[18px] bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#111214]/[.05] px-2.5 py-1 text-[11px] font-bold text-black/60"><Gauge className="size-3" /> {SOURCE_LABEL[r.source] ?? r.source}</span>
                {hasScore
                  ? <span className={`ink-1 rounded-full px-2.5 py-1 text-sm font-extrabold tabular-nums ${toneCls}`}>{Number(r.score)}<span className="text-[11px] font-bold opacity-70">/{Number(r.max_score)}</span></span>
                  : <span className="rounded-full bg-black/[.05] px-2.5 py-1 text-[11px] font-bold text-black/50">No score yet</span>}
              </div>
              <p className="text-sm font-medium leading-6 text-black/70">{r.summary}</p>
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-[var(--muted)]">
                {r.test_count != null && <span>{r.test_count} lab tests</span>}
                {r.avg_purity != null && <span>{Number(r.avg_purity).toFixed(2)}% avg purity</span>}
                {r.would_buy_again_pct != null && <span>{r.would_buy_again_pct}% would buy again</span>}
                <span className="ml-auto inline-flex items-center gap-1 font-bold text-black/45 group-hover:text-black">source <ExternalLink className="size-3" /></span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
