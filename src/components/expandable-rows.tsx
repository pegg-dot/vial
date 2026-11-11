"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { UI } from "@/components/intelligence/research-ui";

// Progressive disclosure for long tables. The first rows are always visible; the rest live in a
// second tbody the button reveals. Rows stay SERVER-rendered — they arrive here as ReactNode
// props, so tables whose cells need server-only logic (content checks, etc.) keep working; this
// component owns nothing but the toggle. Multiple tbody elements in one table are valid HTML.
export function ExpandableRows({ preview, rest, restCount, colSpan, label, bodyClassName }: {
  preview: ReactNode;
  rest: ReactNode;
  restCount: number;
  colSpan: number;
  label: string;
  bodyClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  if (restCount <= 0) return <tbody className={bodyClassName}>{preview}</tbody>;
  return (
    <>
      <tbody className={bodyClassName}>{preview}</tbody>
      <tbody hidden={!open} className={`${bodyClassName ?? ""} border-t border-[#111214]/10`}>{rest}</tbody>
      <tbody>
        <tr>
          <td colSpan={colSpan} className="border-t-2 border-[#111214] bg-[var(--background)] px-5 py-3">
            <button type="button" onClick={() => setOpen((v) => !v)} className={UI.link}>
              {open ? "Show fewer" : label}
              <ChevronDown className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
          </td>
        </tr>
      </tbody>
    </>
  );
}
