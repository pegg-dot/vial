import { MessageSquareText, ThumbsUp, TriangleAlert, ExternalLink } from "lucide-react";
import type { VendorReview } from "@/server/verify/vendor-reviews";

const SENTIMENT: Record<string, { chip: string; label: string; ring: string; bg: string }> = {
  positive: { chip: "bg-emerald-100 text-emerald-800", label: "Mostly positive", ring: "border-emerald-200", bg: "bg-emerald-50/50" },
  mixed: { chip: "bg-amber-100 text-amber-800", label: "Mixed reports", ring: "border-amber-200", bg: "bg-amber-50/50" },
  negative: { chip: "bg-rose-100 text-rose-800", label: "Mostly negative", ring: "border-rose-300", bg: "bg-rose-50/60" },
  scam: { chip: "bg-rose-100 text-rose-800", label: "Scam / fraud reports", ring: "border-rose-300", bg: "bg-rose-50/60" },
  unknown: { chip: "bg-black/[.06] text-black/60", label: "No reviews found", ring: "border-black/[.09]", bg: "bg-black/[.02]" },
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
      <div className="mb-6 flex items-center gap-2.5">
        <MessageSquareText className="size-5 text-black/40" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">What buyers say</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-[-.045em]">Reputation, gathered from the open web</h2>
        </div>
      </div>
      <div className={`rounded-[26px] border ${s.ring} ${s.bg} p-6 sm:p-7`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.chip}`}>{s.label}</span>
          <span className="rounded-full border border-black/[.1] bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-black/55">{review.reviewVolume} review volume</span>
          <span className="rounded-full border border-black/[.1] bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-black/55">{review.confidence} confidence</span>
        </div>
        <p className="mt-4 text-[15px] leading-7 text-black/75">{review.summary}</p>

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
        <p className="mt-5 text-[10px] leading-4 text-black/40">Gathered from public web sources and weighted toward specific, reproducible reports over generic praise — praise is cheap to fake, failure reports and independent lab results are not. A reputation snapshot, not a verdict; ownership and quality can change.</p>
      </div>
    </section>
  );
}
