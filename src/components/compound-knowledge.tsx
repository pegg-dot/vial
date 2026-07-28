import Link from "next/link";
import { BookOpen, ChevronDown } from "lucide-react";
import type { CompoundEducation } from "@/lib/compound-education";
import { goalLabel, goalBlurb } from "@/lib/compound-education";
import { GoalTags } from "./goal-tags";

// The "I just want to understand what this is" panel. A visible plain-English answer, the
// research-goal chips, and expandable dropdowns that answer the real questions a first-time
// buyer has — without any dosing, medical, or human-use guidance (research context only).
export function CompoundKnowledge({
  name, education, stacked = [], showStacks = true,
}: {
  name: string;
  education: CompoundEducation;
  stacked?: { slug: string; name: string }[];
  showStacks?: boolean;
}) {
  const goals = education.goals ?? [];
  return (
    <div className="ink hard rounded-[20px] bg-white p-6 sm:p-8">
      <div className="flex items-center gap-2.5">
        <span className="ink-1 grid size-9 place-items-center rounded-xl bg-[#f0edff]"><BookOpen className="size-4 text-[#5a4be0]" /></span>
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Understand this compound</p>
      </div>
      <h2 className="mt-4 text-2xl font-extrabold tracking-[-.035em] sm:text-3xl">What is {name}?</h2>
      {education.summary ? <p className="mt-3 max-w-3xl text-[15px] font-medium leading-7 text-black/70">{education.summary}</p> : null}
      {goals.length > 0 ? <div className="mt-5"><GoalTags goals={goals} size="md" /></div> : null}

      <div className="mt-6 border-t border-black/[.08]">
        {goals.length > 0 ? (
          <QA q={`What is ${name} researched for?`} open>
            <ul className="space-y-3.5">
              {goals.map((g) => (
                <li key={g} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                  <span className="shrink-0 font-semibold text-black/80 sm:w-52">{goalLabel(g)}</span>
                  <span className="text-black/60">{goalBlurb(g)}</span>
                </li>
              ))}
            </ul>
          </QA>
        ) : null}

        {showStacks && stacked.length > 0 ? (
          <QA q={`What is ${name} commonly stacked with?`}>
            <p className="mb-3">Compounds the research community frequently discusses alongside {name}. Not a protocol or a recommendation — a map of what to read about next.</p>
            <div className="flex flex-wrap gap-2">
              {stacked.map((s) => (
                <Link key={s.slug} href={`/compounds/${s.slug}`} className="inline-flex items-center rounded-full border border-black/[.1] bg-black/[.02] px-3 py-1.5 text-[13px] font-semibold text-black/75 transition hover:border-black/25 hover:bg-black/[.04]">
                  {s.name}
                </Link>
              ))}
            </div>
          </QA>
        ) : null}

        <QA q="What should I check before buying?">
          <ul className="space-y-2.5">
            <li className="flex gap-2.5"><Dot /><span><span className="font-semibold text-black/80">Independent purity.</span> Look for a third-party COA (Janoshik or MZ) showing a <em>measured</em> purity — not just a number the vendor typed.</span></li>
            <li className="flex gap-2.5"><Dot /><span><span className="font-semibold text-black/80">Batch match.</span> The strongest evidence is a certificate for the exact batch you&rsquo;ll receive, attributed to this vendor — check the cross-verification on the listing.</span></li>
            <li className="flex gap-2.5"><Dot /><span><span className="font-semibold text-black/80">Vendor reputation.</span> See how the vendor is talked about in the community before trusting a new name.</span></li>
          </ul>
          <p className="mt-3 text-xs text-black/45">Research context only — VIAL never gives dosing, medical, or human-use guidance.</p>
        </QA>
      </div>
    </div>
  );
}

function QA({ q, children, open }: { q: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-black/[.08] last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-semibold tracking-[-.01em] text-black/85 marker:hidden [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown className="size-4 shrink-0 text-black/40 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="pb-5 pr-2 text-sm leading-6 text-black/65 sm:pr-8">{children}</div>
    </details>
  );
}

function Dot() {
  return <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-400" />;
}
