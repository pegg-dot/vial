import Link from "next/link";
import type { ResolvedStack } from "@/lib/stacks";
import { formatCurrency } from "@/lib/format";
import { VialPlain } from "@/components/vial-art";
import { DataOriginBadge } from "@/components/data-origin-badge";

// A curated stack/blend tile. Blend = a pre-mixed single-vial SKU; Recipe = compounds
// bought separately. Always framed as a discussion, never a protocol.
export function StackCard({ resolved }: { resolved: ResolvedStack }) {
  const { stack, components, priceFrom, anyLive } = resolved;
  const isBlend = stack.kind === "blend";
  return (
    <Link
      href={`/compounds/${components[0].slug}`}
      className="ink-1 hard press group flex w-[280px] shrink-0 snap-start flex-col rounded-[20px] bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {components.slice(0, 3).map((c) => (
            <VialPlain key={c.slug} className="-ml-3 h-12 w-12 first:ml-0" liquid={c.accent?.[0] ?? stack.accent} />
          ))}
        </div>
        <span
          className={`ink-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${
            isBlend ? "bg-[#f0edff] text-[#6d5dfc]" : "bg-[#f0f0ec] text-[var(--muted)]"
          }`}
        >
          {isBlend ? "Blend" : "Recipe"}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <h3 className="text-xl font-extrabold tracking-[-.03em]">{stack.name}</h3>
        {anyLive && <DataOriginBadge origin="live" />}
      </div>
      <p className="mt-1 text-sm font-medium text-[var(--muted)]">{stack.goal}</p>

      {priceFrom != null && (
        <p className="mt-3 text-sm font-extrabold tabular-nums">
          from {formatCurrency(priceFrom)} <span className="font-semibold text-[var(--muted)]">combined</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {components.map((c) => (
          <span key={c.slug} className="ink-1 rounded-full px-2 py-0.5 text-[11px] font-bold">
            {c.name}
          </span>
        ))}
      </div>

      <p className="mt-4 text-[11px] font-medium leading-5 text-[var(--muted)]">
        Commonly discussed research combination — not a protocol.
      </p>
    </Link>
  );
}
