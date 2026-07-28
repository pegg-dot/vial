import { ShieldCheck } from "lucide-react";
import Link from "next/link";

// The home's primary call to action: not "browse a catalog" but "check before you buy".
// Points at the verify tool — the reflex we want people to build.
export function SearchTrigger({ className = "" }: { className?: string }) {
  return <Link href="/verify" className={`ink hard press group flex w-full items-center gap-3 rounded-2xl bg-white px-5 py-4 text-left ${className}`}>
    <ShieldCheck className="size-5 text-[#2b31d8]" />
    <span className="flex-1 text-sm font-medium text-[#111214]/70 sm:text-base">Check a vendor, compound, or COA before you buy</span>
    <span className="hidden rounded-xl bg-[#2b31d8] px-4 py-2 text-xs font-bold text-white sm:block">Verify</span>
  </Link>;
}
