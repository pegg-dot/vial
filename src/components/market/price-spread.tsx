import { formatCurrency } from "@/lib/format";

// Where every listing for a compound sits on one price line — "the market on one screen", drawn.
//
// This replaced a price-history sparkline in the quick view that had nothing to draw: 685 of 904
// live listings carry a single price point, so the chart was one dot at the bottom of a 150px
// box. A listing price exists for every compound with a listing; a history does not yet.
//
// Log scale, because a compound's listings run from single vials to 10-vial kits ($34 → $1,653
// for BPC-157) and on a linear axis 40 of 44 dots share one pixel. Dots that would overlap stack
// upward, so a cluster reads as a cluster. The market median is the dashed tick; the black dot is
// the listing the caller wants the eye on (the best cost per milligram).
const W = 320;
const H = 92;
const PAD = 16;
const BASE = 68;
const R = 4;
const COL = 9;

export function PriceSpread({ prices, median, highlight }: { prices: number[]; median?: number | null; highlight?: number | null }) {
  const sorted = prices.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  const x = (p: number) => (high <= low ? W / 2 : PAD + (Math.log(p / low) / Math.log(high / low)) * (W - PAD * 2));

  // Mark only the first dot at the highlighted price; two listings at one price is one dot's story.
  const hitIndex = highlight != null ? sorted.indexOf(highlight) : -1;
  const stacks = new Map<number, number>();
  const dots = sorted.map((p, i) => {
    const cx = x(p);
    const col = Math.round(cx / COL);
    const k = stacks.get(col) ?? 0;
    stacks.set(col, k + 1);
    return { p, cx, cy: Math.max(16, BASE - k * (R * 2 + 1)), hit: i === hitIndex };
  });
  const medX = median != null && median > 0 ? x(Math.min(Math.max(median, low), high)) : null;
  const nearLeft = medX != null && medX < 60;
  const nearRight = medX != null && medX > W - 60;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`${sorted.length} listings priced from ${formatCurrency(low)} to ${formatCurrency(high)}${median ? `, market median ${formatCurrency(median)}` : ""}`}
    >
      <line x1={PAD} x2={W - PAD} y1={BASE + R + 4} y2={BASE + R + 4} stroke="#111214" strokeWidth="2" strokeLinecap="round" />
      {medX != null && (
        <g>
          <line x1={medX} x2={medX} y1={12} y2={BASE + R + 4} stroke="#111214" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x={medX} y={9} textAnchor={nearLeft ? "start" : nearRight ? "end" : "middle"} fontSize="9.5" fontWeight="700" fill="#111214">
            median {formatCurrency(median!)}
          </text>
        </g>
      )}
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={R} fill={d.hit ? "#111214" : "#12b3a6"} stroke="#ffffff" strokeWidth="1.5" />
      ))}
      <text x={PAD} y={H - 3} fontSize="10.5" fontWeight="800" fill="#111214">{formatCurrency(low)}</text>
      <text x={W - PAD} y={H - 3} textAnchor="end" fontSize="10.5" fontWeight="800" fill="#111214">{formatCurrency(high)}</text>
    </svg>
  );
}
