import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Combination comparisons paused",
  description: "VialGrade has paused compound-stack and blended-product price comparisons pending review.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/stacks" },
};

export default function StacksPage() {
  return (
    <section className="mx-auto max-w-[850px] px-5 py-20 sm:px-8">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#2b31d8]">Research feature paused</p>
      <h1 className="mt-5 text-balance text-4xl font-extrabold tracking-[-.04em] sm:text-6xl">Combination comparisons are unavailable.</h1>
      <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-[var(--muted)]">
        VialGrade has paused compound-stack, blend and lowest-combined-price comparisons while their
        regulatory and consumer-protection implications are reviewed. These combinations have not
        been established as safe, effective, lawful to market, or appropriate for human use.
      </p>
      <Link href="/compounds" className="ink hard-sm press mt-8 inline-flex rounded-full bg-white px-6 py-3 font-bold">
        View individual research records
      </Link>
    </section>
  );
}
