import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldAlert } from "lucide-react";
import { PexSourceVerifier } from "@/components/intelligence/pexiganan-source-verifier";

export const metadata: Metadata = {
  title: "Verify a scientific source | VialGrade",
  description: "Check selected Pexiganan scientific identifiers against an original-source register, with explicit citation roles and limitations.",
  robots: { index: false, follow: false },
};

export default async function ResearchSourceVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialRef = typeof params.ref === "string" ? params.ref.slice(0, 80) : "";
  return (
    <div className="bg-[#faf9f7] pb-24">
      <div className="mx-auto max-w-[1040px] px-5 pt-9 sm:px-8">
        <nav aria-label="Verifier breadcrumbs" className="flex flex-wrap gap-2 text-xs font-semibold text-[#77877e]">
          <Link href="/intelligence/market" className="hover:underline">Research Market</Link>
          <span>/</span>
          <Link href="/intelligence/explore/pexiganan" className="hover:underline">Pexiganan</Link>
          <span>/</span>
          <span aria-current="page" className="text-[#356f61]">Verify source</span>
        </nav>
        <div className="mb-6 mt-8">
          <p className="text-[11px] font-black uppercase tracking-[.13em] text-[#1f8573]">Exact source ID lookup · Pexiganan pilot</p>
          <h1 className="mt-2 text-[clamp(2.4rem,5vw,4rem)] font-extrabold tracking-[-.06em] text-[#17191b]">Verify what a source says.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#65746c]">
            Enter a PubMed PMID, ClinicalTrials.gov NCT number or PubChem CID. VialGrade checks whether the exact identifier is
            in the selected Pexiganan source file and explains what that record does and does not show. This is a limited pilot, not a general claim checker.
          </p>
        </div>
        <PexSourceVerifier initialRef={initialRef} />
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Link href="/intelligence/passports/pexiganan" className="rounded-xl border border-[#dbe5df] bg-white p-5 hover:border-[#26937b]">
            <span className="text-sm font-extrabold text-[#2e5849]">Evidence passport</span>
            <p className="mt-2 text-xs leading-6 text-[#69796f]">Six specific research observations and their source limitations, ready for export.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#2c7868]">Open the passport <ArrowRight className="size-3.5" /></span>
          </Link>
          <Link href="/intelligence/organizations" className="rounded-xl border border-[#dbe5df] bg-white p-5 hover:border-[#26937b]">
            <span className="text-sm font-extrabold text-[#2e5849]">Study sponsors named in the registry</span>
            <p className="mt-2 text-xs leading-6 text-[#69796f]">Which names appear in official trial sponsor fields, and which laboratories are not verified here.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#2c7868]">Inspect attribution <ArrowRight className="size-3.5" /></span>
          </Link>
        </div>
        <p className="mt-7 flex items-start gap-2 text-xs leading-6 text-[#89958b]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          A match means a record is present in this reviewed source index, not that its scientific conclusions, a vendor,
          a certificate or a sample have been authenticated. No user-input data is saved in a research profile.
        </p>
        <Link href="/intelligence/explore/pexiganan" className="mt-6 inline-flex items-center gap-1 text-xs font-bold text-[#30735e] hover:underline">
          <ArrowLeft className="size-3.5" /> Return to Pexiganan
        </Link>
      </div>
    </div>
  );
}
