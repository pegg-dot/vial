import { ThumbsUp, TriangleAlert, ExternalLink } from "lucide-react";
import type { VendorReview } from "@/server/verify/vendor-reviews";

const SENTIMENT: Record<string, { chip: string; label: string; bg: string }> = {
  positive: { chip: "bg-[#e6fbf6] text-[#0e8f80]", label: "Mostly positive", bg: "bg-[#f2fdfa]" },
  mixed: { chip: "bg-[#fff6e6] text-[#b26a00]", label: "Mixed reports", bg: "bg-[#fffaf0]" },
  negative: { chip: "bg-[#ffecea] text-[#d3372c]", label: "Mostly negative", bg: "bg-[#fff5f4]" },
  scam: { chip: "bg-[#ffecea] text-[#d3372c]", label: "Scam / fraud reports", bg: "bg-[#fff5f4]" },
  unknown: { chip: "bg-black/[.06] text-black/60", label: "No reviews found", bg: "bg-white" },
};

// A source name that isn't a full URL is shown as-is; a URL is shown by its host with a link.
function sourceLabel(s: string): { text: string; href?: string } {
  if (/^https?:\/\//i.test(s)) { try { return { text: new URL(s).host.replace(/^www\./, ""), href: s }; } catch { return { text: s }; } }
  return { text: s };
}

// What real buyers report — gathered from the open web and weighted the way the community weights
// trust: specific failure reports and independent lab results over cheap praise.
export function VendorReviewsPanel({ review }: { review: VendorReview }) {
  const s = SENTIMENT[review.sentiment] ?? SENTIMENT.unknown;
  return (
    <section className="mx-auto max-w-[1320px] px-5 pt-14 sm:px-8 sm:pt-20">
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">What buyers say</p>
        <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold leading-[.98] tracking-[-.04em]">Reputation, gathered from the open web</h2>
      </div>
      <div className={`ink hard rounded-[20px] ${s.bg} p-6 sm:p-7`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`ink-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${s.chip}`}>{s.label}</span>
          <span className="ink-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-black/55">{review.reviewVolume} review volume</span>
          <span className="ink-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-black/55">{review.confidence} confidence</span>
        </div>
        <p className="mt-4 text-[15px] font-medium leading-7 text-black/75">{review.summary}</p>

        {(review.positives.length > 0 || review.redFlags.length > 0) && (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {review.positives.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700"><ThumbsUp className="size-3.5" /> What buyers praise</p>
                <ul className="mt-2 space-y-1.5">
                  {review.positives.map((p, i) => <li key={i} className="flex gap-2 text-[13px] leading-5 text-black/65"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />{p}</li>)}
                </ul>
              </div>
            )}
            {review.redFlags.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-700"><TriangleAlert className="size-3.5" /> Red flags reported</p>
                <ul className="mt-2 space-y-1.5">
                  {review.redFlags.map((r, i) => <li key={i} className="flex gap-2 text-[13px] leading-5 text-black/65"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rose-500" />{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {review.sources.length > 0 && (
          <div className="mt-5 border-t border-black/[.08] pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-black/45">Sources</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {review.sources.map((src, i) => { const { text, href } = sourceLabel(src); return href
                ? <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-black/[.1] bg-white px-2.5 py-1 text-[11px] font-semibold text-black/60 hover:border-black/25">{text} <ExternalLink className="size-3" /></a>
                : <span key={i} className="rounded-full border border-black/[.1] bg-white px-2.5 py-1 text-[11px] font-semibold text-black/60">{text}</span>; })}
            </div>
          </div>
        )}
        <p className="mt-5 text-[10px] leading-4 text-black/40">Gathered from public web sources{review.gatheredAt ? ` on ${new Date(review.gatheredAt).toLocaleDateString()}` : ""} and weighted toward specific, reproducible reports over generic praise — praise is cheap to fake, failure reports and independent lab results are not. Reputation decays: ownership and quality change over time, so re-check against current sources before you buy.</p>
      </div>
    </section>
  );
}
