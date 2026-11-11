"use client";
import { useState } from "react";
import { groupVendorHistory, type HistoryItem } from "@/lib/vendor-history";
import { NumberedSection, Pill, UI } from "@/components/intelligence/research-ui";

// The rail sits beside the catalog, which collapses to nine cards. Ungrouped and uncapped it ran
// past 2,000px on a vendor whose last reviewed refresh touched a dozen listings — a column of rows
// that all said the same thing on the same date, dragging the page footer down with it. Two things
// keep it in proportion: runs of one event fold into one row (see lib/vendor-history), and only the
// first few rows show until asked. Nothing is dropped — every folded subject is one tap away, and
// the count above the timeline still reports the raw feed.
//
// `number` is the section's place in the report, handed down by the page so the frame and the
// jump-nav agree. The page's `aside#history` wraps this frame; the frame carries its own id so the
// two stay distinct.
const PREVIEW_ROWS = 5;
const PREVIEW_SUBJECTS = 3;

export function VendorHistoryRail({ history, vendorName, number }: { history: HistoryItem[]; vendorName: string; number: number }) {
  const groups = groupVendorHistory(history);
  const [showAll, setShowAll] = useState(false);
  const [openSubjects, setOpenSubjects] = useState<number[]>([]);
  const shown = showAll ? groups : groups.slice(0, PREVIEW_ROWS);
  const hidden = groups.length - shown.length;

  return (
    // Sticky only matters beside a catalog column; under the evidence-only release the rail is
    // the width of the page and its cell is exactly its own height, so `sticky` is a no-op there.
    <NumberedSection id="history-record" number={number} eyebrow="History" title="What has changed recently?" className="lg:sticky lg:top-32"
      intro={history.length > 0
        ? `${history.length} change${history.length === 1 ? "" : "s"} we have recorded for ${vendorName} — catalog, documents, profile and policy.`
        : `We haven’t recorded any change for ${vendorName} yet.`}>
      {shown.length > 0 && (
        <div className="space-y-0">
          {shown.map((group, index) => {
            const subjectsOpen = openSubjects.includes(index);
            const listed = subjectsOpen ? group.subjects : group.subjects.slice(0, PREVIEW_SUBJECTS);
            const restOfSubjects = group.subjects.length - listed.length;
            return (
              // Keyed by position: a run that could not be folded (see the empty-subject case in
              // groupVendorHistory) can leave two rows carrying the same date, type and headline.
              <div key={`${index}-${group.date}-${group.headline}`} className="relative flex gap-3 pb-5 last:pb-0">
                {index < shown.length - 1 && <span aria-hidden="true" className="absolute left-[6px] top-4 h-full w-0.5 bg-[#111214]/12" />}
                <span aria-hidden="true" className="relative mt-1 size-3.5 shrink-0 rounded-full border-2 border-[#111214] bg-[#2b31d8]" />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs font-bold text-[#4a4d56]">
                    {group.date}
                    {group.count > 1 && <span className="ink-1 rounded-full bg-[#eef0ff] px-1.5 py-px text-[10px] font-extrabold tabular-nums text-[#2b31d8]">&times;{group.count}</span>}
                  </p>
                  <p className="mt-1 text-sm font-bold leading-5 text-[#111214]">{group.headline}</p>
                  {group.subjects.length > 0 && (
                    <p className={UI.small + " mt-1"}>
                      {listed.join(", ")}
                      {restOfSubjects > 0 && (
                        <>
                          {" "}
                          <button type="button" onClick={() => setOpenSubjects((open) => [...open, index])} className={UI.linkSmall}>
                            +{restOfSubjects} more
                          </button>
                        </>
                      )}
                    </p>
                  )}
                  <p className={UI.eyebrowMuted + " mt-1"}>{group.type}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {groups.length > PREVIEW_ROWS && (
        <div className="border-t border-[#111214]/10 pt-4">
          <Pill size="sm" className="w-full" onClick={() => { setShowAll((open) => !open); setOpenSubjects([]); }}>
            {showAll ? `Show the ${PREVIEW_ROWS} most recent` : `Show ${hidden} earlier update${hidden === 1 ? "" : "s"}`}
          </Pill>
        </div>
      )}
    </NumberedSection>
  );
}
