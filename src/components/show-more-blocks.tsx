"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Pill } from "@/components/intelligence/research-ui";

// Block-level sibling of ExpandableRows: a bounded preview of stacked content with the remainder
// behind one toggle. Children are server-rendered and passed through; only the toggle is client.
// The default button is the kit pill; pass buttonClassName to restyle it (e.g. as a flush
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
  const toggle = () => setOpen((v) => !v);
  const text = open ? "Show fewer" : label;
  const chevron = <ChevronDown className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />;
  return (
    <div>
      <div className={className}>
        {preview}
        {open ? rest : null}
      </div>
      {buttonClassName
        ? <button type="button" onClick={toggle} className={buttonClassName}>{text}{chevron}</button>
        : <Pill size="sm" onClick={toggle} className="mt-4">{text}{chevron}</Pill>}
    </div>
  );
}
