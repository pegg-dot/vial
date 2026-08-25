"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Moving between the admin pages.
 *
 * The chrome carried three links — Capture, Review, Published — from when those were the only
 * admin pages. Sources and Traces were added later and never joined it, so the only way to reach
 * them was to type the URL. The whole row was also `hidden sm:flex`, which meant that on a phone
 * there was no way to move between admin pages at all.
 *
 * Laid out in the order the pipeline actually runs, because a reviewer landing mid-way should be
 * able to see where they are in it. The arrows are decorative and hidden from assistive tech; the
 * current page is marked with aria-current rather than by colour alone.
 */
const STEPS = [
  { href: "/admin/sources", label: "Sources", hint: "What we collect and how fresh it is" },
  { href: "/admin/ingest", label: "Capture", hint: "Snapshot a source" },
  { href: "/admin/review", label: "Review", hint: "Decide proposed claims" },
  { href: "/admin/publications", label: "Published", hint: "Publication receipts" },
  { href: "/admin/traces", label: "Traces", hint: "Cause and effect" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Provenance pipeline"
      // Scrolls rather than wrapping or disappearing: five steps do not fit a phone, and hiding
      // them was how they became unreachable in the first place.
      className="-mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 pb-1 text-[11px] font-bold uppercase tracking-[.1em] text-white/55 sm:mx-0 sm:w-auto sm:overflow-visible sm:pb-0"
    >
      {STEPS.map((step, index) => {
        // Exact match only. A prefix match would light up "Sources" while you are on a nested page
        // that merely starts the same way.
        const current = pathname === step.href;
        return (
          <span key={step.href} className="flex shrink-0 items-center gap-1">
            {index > 0 ? <span aria-hidden className="text-white/25">→</span> : null}
            <Link
              href={step.href}
              title={step.hint}
              aria-current={current ? "page" : undefined}
              className={`rounded-full px-2.5 py-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                current ? "bg-white text-[#111214]" : "hover:bg-white/12 hover:text-white"
              }`}
            >
              {step.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
