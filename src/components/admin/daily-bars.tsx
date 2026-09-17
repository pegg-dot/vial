"use client";
import { useState } from "react";

// One measure, one chart, one hue.
//
// Deliberately NOT a multi-series chart with two y-axes. Readers and clicks differ by an order of
// magnitude, and putting them on one plot with two scales lets the axes be chosen to tell whatever
// story you like — the single most common way a chart lies. Small multiples instead: each measure
// keeps its own chart and its own scale, and comparison happens by reading across, honestly.
//
// A single series needs no legend; the heading names it. The value labels are selective (first,
// last, and the peak) rather than one number per bar, which would turn the chart back into a table.
//
// Colours are #2b31d8 and #0e8f80, both already in the VialGrade system, both validated against the
// chart surface: lightness band, chroma floor, CVD separation (deutan ΔE 24.6, tritan 14.1),
// normal-vision separation, and ≥3:1 contrast all pass.

export interface DayValue { day: string; value: number }

const shortDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

export function DailyBars({
  points, heading, note, accent = "#2b31d8", format = (n: number) => n.toLocaleString(),
}: {
  points: DayValue[];
  heading: string;
  note?: string;
  accent?: string;
  format?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...points.map(p => p.value), 0);
  const peak = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  const total = points.reduce((a, p) => a + p.value, 0);
  const shown = hover != null ? points[hover] : null;

  return (
    <figure className="ink hard rounded-[18px] bg-white p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold tracking-[-.01em]">{heading}</h3>
          {note && <p className="mt-1 text-xs font-medium leading-5 text-[var(--muted)]">{note}</p>}
        </div>
        {/* The hovered value replaces the total in place, so the eye never leaves the chart. */}
        <p className="text-right text-xs font-bold tabular-nums text-[var(--muted)]">
          {shown ? <>{shortDay(shown.day)} · <span className="text-[#111214]">{format(shown.value)}</span></> : <>{format(total)} over {points.length} days</>}
        </p>
      </figcaption>

      {max === 0 ? (
        <p className="mt-6 rounded-[12px] border-2 border-dashed border-[#111214]/20 px-4 py-6 text-center text-xs font-semibold text-[var(--muted)]">
          Nothing recorded in this window. That is a real zero, not a missing chart.
        </p>
      ) : (
        <div
          className="mt-4 flex h-32 items-end gap-[2px]"
          role="img"
          aria-label={`${heading}. ${format(total)} total across ${points.length} days, peaking at ${format(points[peak].value)} on ${shortDay(points[peak].day)}.`}
          onMouseLeave={() => setHover(null)}
        >
          {points.map((p, i) => (
            <div
              key={p.day}
              className="group relative flex h-full flex-1 cursor-default items-end"
              onMouseEnter={() => setHover(i)}
            >
              {/* A zero day still draws a 2px stub, so an empty day is visibly empty rather than absent. */}
              <div
                className="w-full rounded-t-[4px] transition-opacity"
                style={{
                  height: p.value === 0 ? "2px" : `${Math.max(4, (p.value / max) * 100)}%`,
                  background: p.value === 0 ? "rgba(17,18,20,.18)" : accent,
                  opacity: hover == null || hover === i ? 1 : 0.35,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {max > 0 && (
        <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]">
          <span>{shortDay(points[0].day)}</span>
          <span className="tabular-nums">peak {format(points[peak].value)}</span>
          <span>{shortDay(points[points.length - 1].day)}</span>
        </div>
      )}

      {/* The table is the relief for anyone who cannot read the bars — colourblind, screen reader,
          printed, or simply wanting the numbers. Every chart ships one. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] font-bold text-[#2b31d8]">Every day as a table</summary>
        <div className="mt-2 max-h-56 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[.1em] text-[var(--muted)]">
              <tr><th className="py-1">Day</th><th className="py-1 text-right">{heading}</th></tr>
            </thead>
            <tbody className="divide-y divide-[#111214]/10">
              {[...points].reverse().map(p => (
                <tr key={p.day}><td className="py-1 tabular-nums">{p.day}</td><td className="py-1 text-right font-semibold tabular-nums">{format(p.value)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
