import { ShieldCheck } from "lucide-react";
import Link from "next/link";

// The home's primary call to action: not "browse a catalog" but "check before you buy".
// Points at the verify tool — the reflex we want people to build.
export function SearchTrigger({ className = "" }: { className?: string }) {
  return <Link href="/verify" className={`group flex w-full items-center gap-3 rounded-full border border-black/[.08] bg-white px-5 py-4 text-left shadow-[0_14px_40px_rgba(18,20,24,.07)] transition hover:-translate-y-0.5 hover:border-black/[.14] hover:shadow-[0_18px_50px_rgba(18,20,24,.11)] ${className}`}>
    <ShieldCheck className="size-5 text-black/45" />
    <span className="flex-1 text-sm text-[var(--muted)] sm:text-base">Check a vendor, compound, or COA before you buy</span>
    <span className="hidden rounded-lg bg-[#111214] px-3 py-1.5 text-[11px] font-semibold text-white sm:block">Verify</span>
  </Link>;
}
