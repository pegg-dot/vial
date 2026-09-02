"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

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
          <td colSpan={colSpan} className="border-t-2 border-[#111214] bg-[#f7f7f4] px-5 py-3">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#2b31d8] hover:underline"
            >
              {open ? "Show fewer" : label}
              <ChevronDown className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          </td>
        </tr>
      </tbody>
    </>
  );
}
