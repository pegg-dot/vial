import type { PricePoint } from "@/lib/price-trend";
import { formatObservedDay, formatObservedPrice } from "@/lib/price-trend";

// A dated step chart of a listing's (or a compound's) observed prices.
//
// A step, not a line: a price holds until the next check, and joining two checks with a slope
// would draw a movement nobody observed. Unavailable days break the line and mark the baseline;
// unchecked days are gaps. X is time, not index — the old sparkline placed points evenly, so
// a check yesterday and a check three months ago sat the same distance apart.
//
// The text alternative is the SAME sentence the sighted reader gets (`description`), never a
// synthetic "from $a to $b" that would assert a trend the copy does not. The data table under
// <details> is the long description; in compact placements it is visually hidden but present.
export function PriceSeries({ points, description, accent = "#111214", height = 58, compact = false, uid }: {
  points: PricePoint[];
  description: string;
  accent?: string;
  height?: number;
  compact?: boolean;
  uid?: string;
}) {
  const width = 180;
  const pad = 5;
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const priced = sorted.filter((p) => p.available && p.price !== null);
  const prices = priced.map((p) => p.price as number);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 1;
  const range = Math.max(max - min, Math.max(min * 0.02, 0.01));
  const t0 = sorted.length ? Date.parse(`${sorted[0].day}T00:00:00Z`) : 0;
  const t1 = sorted.length ? Date.parse(`${sorted[sorted.length - 1].day}T00:00:00Z`) : 1;
  const span = Math.max(t1 - t0, 1);
  const x = (day: string) => pad + ((Date.parse(`${day}T00:00:00Z`) - t0) / span) * (width - pad * 2);
  const y = (price: number) => height - pad - ((price - min) / range) * (height - pad * 2);
  const baseline = height - pad;

  // Segments of consecutive available points; each extends horizontally to where the next
  // observation (available or not) begins, or to the right edge for the latest one.
  const segments: string[] = [];
  const gaps: number[] = [];
  let current: string[] = [];
  sorted.forEach((p, i) => {
    const next = sorted[i + 1];
    const endX = next ? x(next.day) : width - pad;
    if (p.available && p.price !== null) {
      current.push(`${x(p.day)},${y(p.price)}`, `${endX},${y(p.price)}`);
    } else {
      gaps.push(x(p.day));
      if (current.length) { segments.push(current.join(" ")); current = []; }
    }
  });
  if (current.length) segments.push(current.join(" "));
  const last = priced[priced.length - 1];
  const id = uid ? uid.replace(/[^a-z0-9]/gi, "") : "";

  return (
    <figure className="m-0 h-full w-full">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label={description} data-series={id || undefined}>
        {segments.map((seg, i) => (
          <polyline key={i} points={seg} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
        {gaps.map((gx, i) => <Dot key={`gap-${i}`} cx={gx} cy={baseline} size={5.2} fill="white" ring={accent} />)}
        {last ? <Dot cx={x(last.day)} cy={y(last.price as number)} size={6} fill={accent} ring="white" /> : null}
      </svg>
      <details className={compact ? "sr-only" : "mt-2 text-[11px] leading-4 text-black/60"}>
        <summary className="cursor-pointer font-semibold">Every observation</summary>
        <table className="mt-1 w-full text-left tabular-nums">
          <thead><tr><th className="pr-3 font-semibold">Date</th><th className="font-semibold">Observed</th></tr></thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.day}><td className="pr-3"><time dateTime={p.day}>{formatObservedDay(p.day)}</time></td><td>{p.available && p.price !== null ? formatObservedPrice(p.price) : "Not available"}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

// A marker, drawn as a pair of zero-length round-capped lines rather than a <circle>.
//
// The chart stretches to whatever width its card gives it (preserveAspectRatio="none"), which is
// the only way a step chart fills a tile that is 340px wide on a phone and 1,250px wide on its own
// row. Under that stretch a circle renders as a flat ellipse — but a round line cap is sized in
// screen pixels, so it stays a dot at any width, exactly like the non-scaling strokes around it.
function Dot({ cx, cy, size, fill, ring }: { cx: number; cy: number; size: number; fill: string; ring: string }) {
  return (
    <g>
      <line x1={cx} y1={cy} x2={cx} y2={cy} stroke={ring} strokeWidth={size + 2.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={cx} y1={cy} x2={cx} y2={cy} stroke={fill} strokeWidth={size} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </g>
  );
}
