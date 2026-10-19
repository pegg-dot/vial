import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, ClipboardList, ScanSearch, ShieldAlert } from "lucide-react";
import { ResearchWorkpaperActions } from "@/components/intelligence/research-workpaper-actions";
import {
  PexEvidenceClaimGrid, PexEvidenceScopeStrip, PexNoLabVerification, PexSourceRegister,
} from "@/components/intelligence/pexiganan-evidence";
import { PexTrialNetworkLive, PexTrialNetworkLoading } from "@/components/intelligence/pexiganan-trial-network";
import {
  PEXIGANAN_NETWORK_VERSION, PEXIGANAN_REVIEW_DATE, pexEvidencePassportMarkdown,
} from "@/lib/pexiganan-evidence-network";

export const metadata: Metadata = {
  title: "Pexiganan evidence passport | VialGrade",
  description: "Source-traceable record of what an original membrane experiment, registered trial and publication links do and do not establish about pexiganan.",
  robots: { index: false, follow: false },
};

export default function PexigananEvidencePassportPage() {
  return (
    <div className="bg-[#faf9f7] pb-24">
      <div className="mx-auto max-w-[1170px] px-5 pt-8 sm:px-8">
        <nav aria-label="Evidence passport breadcrumbs" className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#72817a]">
          <Link href="/intelligence" className="hover:underline">Research Market</Link>
          <span aria-hidden="true">/</span>
          <Link href="/intelligence/explore/pexiganan" className="hover:underline">Pexiganan</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-[#2d7560]">Evidence passport</span>
        </nav>

        <section className="mt-6 overflow-hidden rounded-[23px] border-2 border-[#17191b] bg-white">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_235px]">
            <div className="bg-[#dcffed] px-6 py-9 sm:px-9 sm:py-12">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#a4d4b8] bg-white px-3 py-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#286953]">
                <ClipboardList className="size-4" /> Evidence passport · Research pilot
              </span>
              <h1 className="mt-5 max-w-3xl text-[clamp(2.5rem,5.8vw,4.4rem)] font-extrabold leading-[1.03] tracking-[-.065em] text-[#17191b]">
                Pexiganan, with the receipts.
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-7 text-[#496458] sm:text-base">
                Six precise observations, ten source records and four individually selected registered studies.
                Open every original record, see which connections have been checked, and find what still needs a scientific reviewer.
              </p>
              <div className="mt-5"><PexEvidenceScopeStrip /></div>
            </div>
            <div className="flex flex-col justify-between gap-5 border-t-2 border-[#17191b] bg-[#17191b] p-6 text-white lg:border-l-2 lg:border-t-0">
              <div>
                <BadgeCheck className="size-7 text-[#aef2d6]" />
                <p className="mt-4 text-[11px] font-bold uppercase tracking-[.12em] text-white/50">The bottom line</p>
                <p className="mt-2 text-xl font-extrabold leading-snug">Source relationships, not a scientific verdict.</p>
                <p className="mt-3 text-xs leading-6 text-white/65">
                  A reported registry result is not a benefit finding. A DERIVED review is not a clinical primary outcome paper.
                </p>
              </div>
              <p className="text-[11px] leading-5 text-[#cbd7d1]">Editorial source check {PEXIGANAN_REVIEW_DATE} · {PEXIGANAN_NETWORK_VERSION}</p>
            </div>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#d8e2dc] bg-white p-4 sm:px-6">
          <div>
            <p className="text-sm font-extrabold">Save the source trail</p>
            <p className="mt-1 text-xs text-[#73817a]">Export all checked claims, sources and limitations without an account.</p>
          </div>
          <ResearchWorkpaperActions markdown={pexEvidencePassportMarkdown()} filename="vialgrade-pexiganan-evidence-passport.md" />
        </div>

        <nav aria-label="Passport sections" className="sticky top-[68px] z-20 -mx-5 mt-5 flex gap-2 overflow-x-auto border-b border-[#e6e8e6] bg-[#faf9f7]/95 px-5 py-3 text-xs font-bold backdrop-blur sm:mx-0 sm:px-0">
          <a href="#passport-claims" className="shrink-0 rounded-full border border-[#d8e2db] bg-white px-4 py-2.5 hover:text-[#167f69]">Six claims</a>
          <a href="#pexiganan-trials" className="shrink-0 rounded-full border border-[#d8e2db] bg-white px-4 py-2.5 hover:text-[#167f69]">Four studies</a>
          <Link href="/intelligence/verify?ref=PMID%2036781451" className="shrink-0 rounded-full border border-[#d8e2db] bg-white px-4 py-2.5 hover:text-[#167f69]">Verify a source</Link>
          <Link href="/intelligence/organizations" className="shrink-0 rounded-full border border-[#d8e2db] bg-white px-4 py-2.5 hover:text-[#167f69]">Sponsors & labs</Link>
        </nav>

        <div id="passport-claims" className="mt-9 scroll-mt-36"><PexEvidenceClaimGrid /></div>

        <section className="mt-10 rounded-2xl border border-[#d8e5dd] bg-[#eaf8f0] p-5 sm:p-7">
          <div className="flex items-center gap-2 text-[#246c5b]"><ScanSearch className="size-5" /><h2 className="text-lg font-extrabold">Try a real source check</h2></div>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[#5a7064]">
            Search <strong>PMID 36781451</strong>. The original registry cites it as DERIVED, but PubMed classifies it as a review. Our verifier shows both facts and their limitation instead of turning that bibliography label into a result claim.
          </p>
          <Link href="/intelligence/verify?ref=PMID%2036781451" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#17191b] bg-white px-4 py-3 text-xs font-extrabold hover:bg-[#fafffc]">
            Verify PMID 36781451 <ArrowRight className="size-4" />
          </Link>
        </section>

        <div className="mt-10">
          <Suspense fallback={<PexTrialNetworkLoading />}>
            <PexTrialNetworkLive />
          </Suspense>
        </div>

        <div className="mt-8 space-y-5">
          <PexSourceRegister />
          <PexNoLabVerification />
        </div>

        <section className="mt-9 flex flex-wrap justify-between gap-3 border-t border-[#e3e7e3] pt-6">
          <Link href="/intelligence/explore/pexiganan" className="inline-flex min-h-10 items-center gap-2 text-xs font-extrabold text-[#286955] hover:underline">
            <ArrowLeft className="size-4" /> Back to compound dossier
          </Link>
          <Link href="/intelligence/organizations" className="inline-flex min-h-10 items-center gap-2 text-xs font-extrabold text-[#286955] hover:underline">
            Organizations behind these records <ArrowRight className="size-4" />
          </Link>
        </section>

        <p className="mt-6 flex gap-2 text-xs leading-6 text-[#878f8b]">
          <ShieldAlert className="mt-1 size-4 shrink-0" />
          This passport is a selected-source metadata and claim-provenance review, not laboratory accreditation,
          medical advice, clinical-evidence certainty, an allegation of reporting misconduct, or a market-ready seller verification.
          Scientific methods review, source-rights and any use in professional decisions remain separate.
        </p>
        <a href="https://clinicaltrials.gov/study/NCT01594762" target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#45786a] hover:underline">
          Official example trial <ArrowUpRight className="size-3" />
        </a>
      </div>
    </div>
  );
}
