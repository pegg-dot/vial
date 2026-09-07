"use client";
import { useState } from "react";
import { groupVendorHistory, type HistoryItem } from "@/lib/vendor-history";

// The rail sits beside the catalog, which collapses to nine cards. Ungrouped and uncapped it ran
// past 2,000px on a vendor whose last reviewed refresh touched a dozen listings — a column of rows
// that all said the same thing on the same date, dragging the page footer down with it. Two things
// keep it in proportion: runs of one event fold into one row (see lib/vendor-history), and only the
// first few rows show until asked. Nothing is dropped — every folded subject is one tap away, and
// the count above the timeline still reports the raw feed.
const PREVIEW_ROWS = 5;
const PREVIEW_SUBJECTS = 3;

export function VendorHistoryRail({ history, vendorName }: { history: HistoryItem[]; vendorName: string }) {
  const groups = groupVendorHistory(history);
  const [showAll, setShowAll] = useState(false);
  const [openSubjects, setOpenSubjects] = useState<number[]>([]);
  const shown = showAll ? groups : groups.slice(0, PREVIEW_ROWS);
  const hidden = groups.length - shown.length;

  return (
    <div className="ink-1 hard-sm sticky top-32 rounded-[16px] bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#2b31d8]">History</p>
      <h2 className="mt-2 text-lg font-extrabold tracking-[-.02em]">What has changed recently?</h2>
      <p className="mt-2 text-xs font-medium leading-5 text-[var(--muted)]">
        {history.length > 0
          ? `${history.length} change${history.length === 1 ? "" : "s"} we have recorded for ${vendorName} — catalog, documents, profile and policy.`
          : `We haven’t recorded any change for ${vendorName} yet.`}
      </p>
      <div className="mt-5 space-y-0">
        {shown.map((group, index) => {
          const subjectsOpen = openSubjects.includes(index);
          const listed = subjectsOpen ? group.subjects : group.subjects.slice(0, PREVIEW_SUBJECTS);
          const restOfSubjects = group.subjects.length - listed.length;
          return (
            // Keyed by position: a run that could not be folded (see the empty-subject case in
            // groupVendorHistory) can leave two rows carrying the same date, type and headline.
            <div key={`${index}-${group.date}-${group.headline}`} className="relative flex gap-3 pb-5 last:pb-0">
              {index < shown.length - 1 && <span className="absolute left-[6px] top-4 h-full w-0.5 bg-[#111214]/12" />}
              <span className="relative mt-1 size-3.5 shrink-0 rounded-full border-2 border-[#111214] bg-[#2b31d8]" />
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-bold text-black/45">
                  {group.date}
                  {group.count > 1 && <span className="ink-1 rounded-full bg-[#e9eaff] px-1.5 py-px text-[10px] font-extrabold tabular-nums text-[#2b31d8]">&times;{group.count}</span>}
                </p>
                <p className="mt-1 text-sm font-semibold leading-5">{group.headline}</p>
                {group.subjects.length > 0 && (
                  <p className="mt-1 text-xs font-medium leading-5 text-[var(--muted)]">
                    {listed.join(", ")}
                    {restOfSubjects > 0 && (
                      <>
                        {" "}
                        <button type="button" onClick={() => setOpenSubjects((open) => [...open, index])} className="font-bold text-[#2b31d8] underline underline-offset-2">
                          +{restOfSubjects} more
                        </button>
                      </>
                    )}
                  </p>
                )}
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{group.type}</p>
              </div>
            </div>
          );
        })}
      </div>
      {groups.length > PREVIEW_ROWS && (
        <div className="mt-4 border-t-2 border-[#111214]/10 pt-4">
          <button
            type="button"
            onClick={() => { setShowAll((open) => !open); setOpenSubjects([]); }}
            className="ink-1 hard-sm press w-full rounded-full bg-white px-4 py-2 text-xs font-bold"
          >
            {showAll ? `Show the ${PREVIEW_ROWS} most recent` : `Show ${hidden} earlier update${hidden === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}
