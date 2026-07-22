import type { DataOrigin } from "@/lib/types";

// Honest provenance marker. 'live' = aggregated from a real public third-party source;
// 'demo' = seeded demo sample. Never implies endorsement or human-use safety.
export function DataOriginBadge({ origin, className = "" }: { origin: DataOrigin; className?: string }) {
  if (origin === "live") {
    return (
      <span
        title="Aggregated from a real public source (vendor page, lab feed). Not an endorsement or a safety claim."
        className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ${className}`}
      >
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-70 motion-reduce:hidden" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" />
        </span>
        Live data
      </span>
    );
  }
  return (
    <span
      title="Demo sample data — not a real vendor, price, or test. Used to illustrate the interface."
      className={`inline-flex items-center gap-1.5 rounded-full bg-black/[.05] px-2.5 py-1 text-[11px] font-semibold text-black/55 ${className}`}
    >
      Demo data
    </span>
  );
}
