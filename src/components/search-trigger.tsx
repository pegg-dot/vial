import { Search } from "lucide-react";
import Link from "next/link";
export function SearchTrigger({ className = "" }: { className?: string }) {
  return <Link href="/search" className={`group flex w-full items-center gap-3 rounded-full border border-black/[.08] bg-white px-5 py-4 text-left shadow-[0_14px_40px_rgba(18,20,24,.07)] transition hover:-translate-y-0.5 hover:border-black/[.14] hover:shadow-[0_18px_50px_rgba(18,20,24,.11)] ${className}`}>
    <Search className="size-5 text-black/45" />
    <span className="flex-1 text-sm text-[var(--muted)] sm:text-base">Search compounds, vendors, products, or batches</span>
    <span className="hidden rounded-lg border border-black/[.08] bg-black/[.035] px-2 py-1 text-[10px] font-semibold text-black/45 sm:block">Aliases + typo tolerance</span>
  </Link>;
}
