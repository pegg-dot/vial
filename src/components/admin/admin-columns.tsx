// A small single-series column chart for the admin pages: counts over consecutive days or weeks.
//
// Server-rendered, no script. One hue (the brand blue, checked against the white surface), since
// there is one series and the title says what it is. Columns are capped at 24px, rounded at the
// data end and square on a hairline baseline, with air between them. Each column's whole slot is
// the hover and focus target and shows its own value; the peak is labelled directly, the axis
// carries the range, and every value is also in the table under the chart.

export interface ColumnPoint {
  /** Short label for the tooltip and the table ("Nov 14", "week of Nov 10"). */
  label: string;
  value: number;
}

export function AdminColumns({ points, title, unit, emptyText, startLabel, endLabel }: {
  points: readonly ColumnPoint[];
  /** What is plotted, as the accessible name. */
  title: string;
  /** Singular noun for a value ("signup", "listing"). */
  unit: string;
  /** Shown instead of an all-zero chart. */
  emptyText: string;
  startLabel: string;
  endLabel: string;
}) {
  const max = Math.max(0, ...points.map((p) => p.value));
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const noun = (n: number) => `${n.toLocaleString()} ${unit}${n === 1 ? "" : "s"}`;
  if (max === 0) return <p className="text-sm font-medium text-[var(--muted)]">{emptyText}</p>;
  const peak = points.findIndex((p) => p.value === max);

  return (
    <figure className="min-w-0">
      <div role="img" aria-label={`${title}: ${noun(total)} in total, peak ${noun(max)} (${points[peak].label}).`}
        className="flex h-32 items-end gap-[2px] border-b border-[#111214]/25 pt-6">
        {points.map((p, i) => (
          <div key={p.label + i} tabIndex={0}
            className="group relative flex h-full min-w-0 flex-1 items-end justify-center rounded-t-[6px] outline-none hover:bg-[#111214]/[.05] focus-visible:bg-[#111214]/[.08]">
            {/* A day with nothing keeps its slot and shows no column: zero is drawn as absence, not as a stub. */}
            {p.value > 0 && <span className="block w-full max-w-[24px] rounded-t-[4px] bg-[#2b31d8]" style={{ height: `${Math.max(3, (p.value / max) * 100)}%` }} />}
            {i === peak && <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[11px] font-extrabold tabular-nums text-[#111214] group-hover:hidden group-focus-visible:hidden" style={{ bottom: `calc(${(p.value / max) * 100}% + 2px)` }}>{p.value.toLocaleString()}</span>}
            <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-[#111214] px-2.5 py-1.5 text-[11px] font-medium text-white group-hover:block group-focus-visible:block">
              <strong className="font-extrabold tabular-nums">{noun(p.value)}</strong> · {p.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-medium tabular-nums text-[var(--muted)]">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
      <details className="mt-2">
        <summary className="w-fit cursor-pointer text-xs font-bold text-[#2b31d8] underline underline-offset-2">View as a table</summary>
        <table className="mt-2 w-full max-w-sm text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[.1em] text-[var(--muted)]"><tr><th className="py-1 pr-4 font-bold">Period</th><th className="py-1 font-bold">{unit[0].toUpperCase() + unit.slice(1)}s</th></tr></thead>
          <tbody className="divide-y divide-[#111214]/10">
            {points.map((p, i) => <tr key={p.label + i}><td className="py-1 pr-4 font-medium">{p.label}</td><td className="py-1 font-bold tabular-nums">{p.value.toLocaleString()}</td></tr>)}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
