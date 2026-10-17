import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, FileSearch } from "lucide-react";

export const metadata: Metadata = {
  title: "Interactive verification temporarily paused",
  description: "VialGrade's interactive COA and vendor query tool is paused while its privacy, source-provenance and claims controls are reviewed.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/verify" },
};

export default function VerifyPage() {
  return (
    <section className="mx-auto max-w-[850px] px-5 py-20 sm:px-8 sm:py-24">
      <span className="ink-1 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[.12em] text-[#2b31d8]">
        <FileSearch className="size-4" /> Source verification · under review
      </span>
      <h1 className="mt-6 text-balance text-4xl font-extrabold leading-tight tracking-[-.05em] sm:text-6xl">
        Interactive verification is temporarily paused.
      </h1>
      <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted)]">
        We are reviewing how user-entered queries are handled, how certificate issuers are
        confirmed, and how to distinguish a document match from physical sample authentication.
        VialGrade does not accept new verification queries or PDF uploads during this review.
      </p>
      <div className="ink-1 mt-8 flex items-start gap-3 rounded-[16px] bg-[#fff6e6] p-5">
        <CircleAlert className="mt-1 size-5 shrink-0 text-[#b26a00]" />
        <p className="text-sm leading-7">
          A found certificate, code, PDF or vendor grade does not establish a vial&rsquo;s identity,
          sterility, safety, FDA approval or legality. Do not treat a laboratory report
          as a purchasing or treatment recommendation.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap gap-4">
        <Link href="/intelligence" className="ink hard-sm press inline-flex rounded-full bg-[#111214] px-6 py-3 text-sm font-bold text-white">Explore research intelligence</Link>
        <Link href="/research" className="ink hard-sm press inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold">Browse public laboratory records</Link>
      </div>
      <p className="mt-6 text-xs leading-6 text-[var(--muted)]">
        Primary documents should be checked with their original issuer. The old interactive
        verification interface will not be re-enabled without privacy and provenance review.
      </p>
    </section>
  );
}
