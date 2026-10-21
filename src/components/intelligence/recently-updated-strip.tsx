import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatUpdateDate, recentlyUpdated } from "@/lib/research-recent-updates";

export function RecentlyUpdatedStrip() {
  const items = recentlyUpdated();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recently-updated-heading" className="border-y-2 border-[#111214] bg-white">
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="recently-updated-heading" className="text-[11px] font-bold uppercase tracking-[.18em] text-[#2b31d8]">Recently updated</h2>
          <p className="text-xs font-medium leading-6 text-[#666970]">Dates show when VialGrade last reviewed a page&apos;s source file, not when a study changed.</p>
        </div>
        <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(item => (
            <li key={item.id}>
              <Link href={item.href} className="group inline-flex min-h-6 flex-col text-left">
                <time dateTime={item.date} className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0e8f80]">{formatUpdateDate(item.date)}</time>
                <span className="mt-1 inline-flex items-start gap-1 self-start text-sm font-extrabold text-[#2b31d8] group-hover:underline">{item.title}<ArrowUpRight className="mt-0.5 size-4 shrink-0" aria-hidden="true" /></span>
                <span className="mt-1 text-xs font-medium leading-5 text-[#666970]">{item.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
