import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Combination price comparisons paused",
  description: "This stack or blend comparison is unavailable pending regulatory review.",
  robots: { index: false, follow: true },
};

export default function StackDetailPage() {
  return (
    <section className="mx-auto max-w-[850px] px-5 py-20 sm:px-8">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#2b31d8]">Research feature paused</p>
      <h1 className="mt-5 text-balance text-4xl font-extrabold tracking-[-.04em] sm:text-6xl">This combination analysis is paused.</h1>
      <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-[var(--muted)]">
        VialGrade no longer publishes lowest-price assembly instructions or seller comparisons for
        compound stacks and blends. Descriptions of combinations are not human-use directions,
        and no laboratory report on this site proves that combining compounds is safe.
      </p>
      <Link href="/compounds" className="ink hard-sm press mt-8 inline-flex rounded-full bg-white px-6 py-3 font-bold">
        Browse individual compound evidence
      </Link>
    </section>
  );
}
