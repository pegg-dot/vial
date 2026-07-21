import { ExternalLink, MessagesSquare } from "lucide-react";
import type { StoredCommunitySignal } from "@/server/ingest/reddit";

const SENTIMENT: Record<string, { chip: string; label: string }> = {
  positive: { chip: "bg-emerald-100 text-emerald-800", label: "Mostly positive" },
  mixed: { chip: "bg-amber-100 text-amber-800", label: "Mixed" },
  negative: { chip: "bg-rose-100 text-rose-800", label: "Complaints reported" },
  unknown: { chip: "bg-black/[.06] text-black/60", label: "No mentions found" },
};

const FLAG_DOT: Record<string, string> = { negative: "bg-rose-500", positive: "bg-emerald-500", neutral: "bg-black/25" };

// What r/Peptides actually says about this vendor — the community-reputation layer. A signal,
// never a verdict: silence isn't safety and a vouch isn't proof of what's in the vial.
export function CommunitySignalCard({ signal }: { signal: StoredCommunitySignal }) {
  const s = SENTIMENT[signal.sentiment] ?? SENTIMENT.unknown;
  const posts = Array.isArray(signal.top_posts) ? signal.top_posts : [];
  const updated = signal.fetched_at ? new Date(signal.fetched_at).toLocaleDateString() : null;
  return (
    <section className="mx-auto max-w-[1320px] px-5 pt-14 sm:px-8 sm:pt-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Community</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">What r/Peptides says</h2>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${s.chip}`}><MessagesSquare className="size-3" /> {s.label}</span>
      </div>
      <div className="mt-6 rounded-[26px] border border-black/[.07] bg-white p-6 sm:p-7">
        <div className="flex flex-wrap gap-6 border-b border-black/[.06] pb-5">
          <Stat value={String(signal.mention_count)} label="Mentions found" />
          <Stat value={String(signal.negative_count)} label="Scam / quality complaints" tone={signal.negative_count > 0 ? "rose" : undefined} />
          <Stat value={String(signal.positive_count)} label="Vouches" tone={signal.positive_count > 0 ? "emerald" : undefined} />
        </div>
        {posts.length > 0 ? (
          <ul className="mt-5 space-y-3">
            {posts.map((p, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${FLAG_DOT[p.flag] ?? "bg-black/25"}`} />
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="group flex-1 text-sm leading-5 hover:underline">
                  {p.title}
                  <ExternalLink className="ml-1 inline size-3 text-black/30 transition group-hover:text-black" />
                </a>
                {p.ups > 0 ? <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">▲ {p.ups}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-[var(--muted)]">No r/Peptides discussion surfaced for this vendor. Real vendors usually get talked about — absence of mentions is a mild signal, not a clean bill of health.</p>
        )}
        <p className="mt-6 text-[10px] leading-4 text-black/40">Aggregated from r/Peptides{updated ? ` · updated ${updated}` : ""}. A community-reputation signal, not a verdict — read the threads yourself before deciding.</p>
      </div>
    </section>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: "rose" | "emerald" }) {
  const color = tone === "rose" ? "text-rose-600" : tone === "emerald" ? "text-emerald-600" : "text-black";
  return (
    <div>
      <p className={`text-2xl font-semibold tracking-[-.04em] ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}
