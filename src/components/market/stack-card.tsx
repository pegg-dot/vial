import Link from "next/link";
import type { ResolvedStack } from "@/lib/stacks";
import { formatCurrency } from "@/lib/format";
import { VialPlain } from "@/components/vial-art";
import { DataOriginBadge } from "@/components/data-origin-badge";

// A curated stack/blend tile. Blend = a pre-mixed single-vial SKU; Recipe = compounds
// bought separately. Always framed as a discussion, never a protocol.
//
// It links to the stack's OWN page. It used to link to `/compounds/${components[0].slug}` — the
// first compound in the recipe — so pressing "GLOW" or "KLOW" opened GHK-Cu and "Wolverine" opened
// BPC-157, a page that never mentioned the stack the reader had just pressed.
//
// `fluid` drops the fixed carousel width so the tile can fill a grid cell on /stacks.
export function StackCard({ resolved, fluid = false }: { resolved: ResolvedStack; fluid?: boolean }) {
  const { stack, components, priceFrom, anyLive } = resolved;
  const isBlend = stack.kind === "blend";
  return (
    <Link
      href={`/stacks/${stack.slug}`}
      className={`ink-1 hard-sm press group flex shrink-0 snap-start flex-col rounded-[16px] bg-white p-4 ${fluid ? "w-full" : "w-[264px]"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {components.slice(0, 3).map((c) => (
            <VialPlain key={c.slug} className="-ml-3 h-11 w-11 first:ml-0" liquid={c.accent?.[0] ?? stack.accent} />
          ))}
        </div>
        <span
          className={`ink-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${
            isBlend ? "bg-[#f0edff] text-[#6d5dfc]" : "bg-white text-[var(--muted)]"
          }`}
        >
          {isBlend ? "Blend" : "Recipe"}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <h3 className="truncate text-[18px] font-extrabold tracking-[-.03em]">{stack.name}</h3>
        {anyLive && <DataOriginBadge origin="live" compact />}
      </div>
      <p className="mt-0.5 truncate text-[13px] font-medium text-[var(--muted)]">{stack.goal}</p>

      {/* Sum of the components' MEDIANS — the tile has compounds, not listings, so it cannot claim
          a "from" price. The stack page has the real lowest-combined number. */}
      {priceFrom != null && (
        <p className="mt-2.5 text-[14px] font-extrabold tabular-nums">
          {formatCurrency(priceFrom)} <span className="font-semibold text-[var(--muted)]">median combined</span>
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {components.map((c) => (
          <span key={c.slug} className="ink-1 rounded-full px-2 py-0.5 text-[11px] font-bold">
            {c.name}
          </span>
        ))}
      </div>

      <p className="mt-3 text-[11px] font-medium leading-5 text-[var(--muted)]">
        Commonly discussed research combination &mdash; not a protocol.
      </p>
    </Link>
  );
}
