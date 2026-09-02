"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Block-level sibling of ExpandableRows: a bounded preview of stacked content with the remainder
// behind one toggle. Children are server-rendered and passed through; only the toggle is client.
// The default button is a floating pill; pass buttonClassName to restyle it (e.g. as a flush
// footer row when the blocks live inside one card container).
export function ShowMoreBlocks({ preview, rest, restCount, label, className, buttonClassName }: {
  preview: ReactNode;
  rest: ReactNode;
  restCount: number;
  label: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  if (restCount <= 0) return <div className={className}>{preview}</div>;
  return (
    <div>
      <div className={className}>
        {preview}
        {open ? rest : null}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={buttonClassName ?? "ink-1 hard-sm press mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#2b31d8]"}
      >
        {open ? "Show fewer" : label}
        <ChevronDown className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
}
