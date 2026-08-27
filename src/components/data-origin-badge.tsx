import type { DataOrigin } from "@/lib/types";

// Honest provenance marker. 'live' = aggregated from a real public third-party source;
// 'demo' = seeded demo sample. Never implies endorsement or human-use safety.
//
// `compact` is the same marker at card density: the pulse dot and one word, no pill. Every
// listing on the market is Live, so a full pill on each of 900 tiles was the loudest thing on the
// page while telling the reader nothing they could act on — but a record still has to SAY it is
// Live (AGENTS.md), so the marker stays on every card; it just stops shouting.
const LIVE_TITLE = "Aggregated from a real public source (vendor page, lab feed). Not an endorsement or a safety claim.";
const DEMO_TITLE = "Demo sample data — not a real vendor, price, or test. Used to illustrate the interface.";

function Pulse() {
  return (
    <span className="relative flex size-1.5">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#12b3a6] opacity-70 motion-reduce:hidden" />
      <span className="relative inline-flex size-full rounded-full bg-[#0e8f80]" />
    </span>
  );
}

export function DataOriginBadge({ origin, className = "", compact = false }: { origin: DataOrigin; className?: string; compact?: boolean }) {
  if (compact) {
    return origin === "live" ? (
      <span title={LIVE_TITLE} className={`inline-flex shrink-0 items-center gap-1 text-[10px] font-extrabold uppercase tracking-[.08em] text-[#0e8f80] ${className}`}>
        <Pulse /> Live
      </span>
    ) : (
      <span title={DEMO_TITLE} className={`inline-flex shrink-0 items-center gap-1 text-[10px] font-extrabold uppercase tracking-[.08em] text-[var(--muted)] ${className}`}>
        Demo
      </span>
    );
  }
  if (origin === "live") {
    return (
      <span
        title={LIVE_TITLE}
        className={`ink-1 inline-flex items-center gap-1.5 rounded-full bg-[#e6fbf4] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#0e8f80] ${className}`}
      >
        <Pulse />
        Live data
      </span>
    );
  }
  return (
    <span
      title={DEMO_TITLE}
      className={`ink-1 inline-flex items-center gap-1.5 rounded-full bg-[#f2f2ef] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted)] ${className}`}
    >
      Demo data
    </span>
  );
}
