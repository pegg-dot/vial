"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BookOpen, CheckCircle2, ClipboardCheck,
  FileSearch, FlaskConical, Microscope, ShieldAlert,
} from "lucide-react";
import {
  PEXIGANAN_CLAIMS, PEXIGANAN_REVIEW_DATE, PEXIGANAN_SOURCES,
  pexSourceById, type PexEvidenceSource,
} from "@/lib/pexiganan-evidence-network";

type ResearchLens = "identity" | "experiment" | "trials" | "material";

const LENSES = [
  {
    key: "identity",
    number: "01",
    label: "Molecular identity",
    short: "What is it?",
    title: "Related molecules are not the same molecule.",
    explanation: "Pexiganan (MSI-78) and Magainin 2 have different PubChem identities. A finding about one does not automatically belong to the other.",
    limit: "A molecular identifier does not establish a biological outcome or confirm the contents of a physical sample.",
    next: "Check the exact name or preparation in the methods section of a particular experiment.",
    sourceIds: ["pubchem-pexiganan", "pubchem-magainin", "mechanism-review"],
    claimIds: ["identity"],
    icon: BookOpen,
    contextLink: "/intelligence/compare?subjects=magainin-2%2Cpexiganan",
    contextLabel: "Compare the related molecules",
  },
  {
    key: "experiment",
    number: "02",
    label: "Original experiments",
    short: "What was tested?",
    title: "A laboratory membrane model is not a patient outcome.",
    explanation: "An original 2003 experiment investigated MSI-78 and model lipid-bilayer structure. Its methods and physical model determine what its findings can support.",
    limit: "The model does not directly demonstrate safety, efficacy or clinical results in people.",
    next: "Read the paper's methods and assess whether the experimental system answers your specific question.",
    sourceIds: ["primary-bilayer", "mechanism-review"],
    claimIds: ["original-experiment"],
    icon: Microscope,
    contextLink: "/intelligence/cases/magainin-pexiganan",
    contextLabel: "Walk through experiment vs trial",
  },
  {
    key: "trials",
    number: "03",
    label: "Registered studies",
    short: "What was recorded?",
    title: "Four selected registrations. No automatic efficacy verdict.",
    explanation: "The source file contains four individual registry records naming pexiganan or MSI-78. Two have posted results sections in the checked snapshot; publication relationships still need source-by-source reconciliation.",
    limit: "A registered intervention, a posted results section or a DERIVED bibliography entry is not proof that a trial succeeded. The 2023 linked paper is a review, not the clinical results publication.",
    next: "Inspect the registry's outcomes and protocol, then reconcile an article to a specific NCT using methods, dates and population.",
    sourceIds: ["onestep-2", "onestep-1", "msi-78-study-a", "msi-78-study-b", "trial-rct-article", "later-review"],
    claimIds: ["registered-program", "early-program", "publication-ambiguity", "review-misreading"],
    icon: FlaskConical,
    contextLink: "/intelligence/studies/NCT01594762",
    contextLabel: "Audit one selected trial",
  },
  {
    key: "material",
    number: "04",
    label: "Physical materials",
    short: "What remains unknown?",
    title: "No physical lot has been authenticated by VialGrade.",
    explanation: "The public molecular record describes a compound, not the identity, purity or chain of custody of any vial, batch or sample. A company report is also not automatically an independent verification.",
    limit: "There is no independently authenticated lot-specific assay or chain-of-custody evidence in this research file.",
    next: "If you already have a sample label and a report, compare the lot identifiers and inspect the original laboratory documentation. A matching number alone does not authenticate a sample.",
    sourceIds: [],
    claimIds: [],
    icon: ClipboardCheck,
    contextLink: "/intelligence/materials?subject=pexiganan",
    contextLabel: "Open the sample/report checklist",
  },
] as const satisfies ReadonlyArray<{
  key: ResearchLens;
  number: string;
  label: string;
  short: string;
  title: string;
  explanation: string;
  limit: string;
  next: string;
  sourceIds: readonly string[];
  claimIds: readonly string[];
  icon: typeof BookOpen;
  contextLink: string;
  contextLabel: string;
}>;

function kindLabel(source: PexEvidenceSource): string {
  switch (source.kind) {
    case "compound": return "Chemical identity";
    case "registry": return "Clinical trial registry";
    case "original-experiment": return "Original experiment";
    case "secondary-review": return "Review article";
    case "clinical-paper": return "Published clinical paper";
  }
}

export function PexigananResearchWorkspace() {
  const [lens, setLens] = useState<ResearchLens>("identity");
  const [sourceId, setSourceId] = useState<string>("pubchem-pexiganan");
  const active = LENSES.find(item => item.key === lens) ?? LENSES[0];
  const source = (active.sourceIds as readonly string[]).includes(sourceId) ? pexSourceById(sourceId) : null;
  const checks = PEXIGANAN_CLAIMS.filter(claim =>
    (active.claimIds as readonly string[]).includes(claim.id));
  const sources = PEXIGANAN_SOURCES.filter(item =>
    (active.sourceIds as readonly string[]).includes(item.id));

  function chooseLens(key: ResearchLens) {
    const next = LENSES.find(item => item.key === key) ?? LENSES[0];
    setLens(key);
    setSourceId(next.sourceIds[0] ?? "");
  }

  return (
    <section id="research-workspace" aria-labelledby="research-workspace-title"
      className="scroll-mt-32 overflow-hidden rounded-[22px] border-2 border-[#111214] bg-white shadow-[5px_5px_0_#111214]">
      <div className="border-b-2 border-[#111214] bg-[#eafff2] px-5 py-6 sm:px-8 sm:py-8">
        <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#147b6b]">Pexiganan · guided evidence inspection</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2 id="research-workspace-title" className="max-w-[18ch] text-[clamp(1.9rem,4.1vw,3.2rem)] font-extrabold leading-[1.04] tracking-[-.05em]">
              One compound. Four different evidence questions.
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[#49675a]">
              Choose what you want to investigate. Then inspect the exact source and what it cannot establish,
              without leaving the research file.
            </p>
          </div>
          <span className="rounded-full border border-[#95c5b1] bg-white px-3 py-2 text-xs font-bold text-[#336a53]">
            Editorial sources checked {PEXIGANAN_REVIEW_DATE}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b-2 border-[#111214] sm:grid-cols-4" aria-label="Select evidence question">
        {LENSES.map(item => {
          const Icon = item.icon;
          const selected = lens === item.key;
          return (
            <button type="button" key={item.key} aria-pressed={selected}
              aria-label={"Investigate " + item.label}
              onClick={() => chooseLens(item.key)}
              className={"group min-h-[112px] border-b border-r border-[#dfe7e1] p-3 text-left outline-offset-[-4px] transition-colors last:border-r-0 focus-visible:outline-2 focus-visible:outline-[#2b31d8] sm:min-h-[122px] sm:grow sm:p-5 " +
                (selected ? "bg-[#2b31d8] text-white" : "bg-white text-[#25322b] hover:bg-[#eef0ff]")}>
              <div className="flex items-center justify-between gap-1">
                <span className={"text-[10px] font-extrabold tracking-[.1em] " + (selected ? "text-white/70" : "text-[#7f8a86]")}>{item.number}</span>
                <Icon className={"size-5 " + (selected ? "text-white" : "text-[#2b31d8]")} />
              </div>
              <span className="mt-2 block text-[13px] font-extrabold leading-5 sm:text-sm">{item.label}</span>
              <span className={"mt-1 block text-[11px] font-medium leading-4 " + (selected ? "text-white/80" : "text-[#68746d]")}>{item.short}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 p-5 sm:p-8" aria-live="polite">
          <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[#2b31d8]">What the record shows · {active.number}/04</p>
          <h3 className="mt-2 text-balance text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-tight tracking-[-.04em]">{active.title}</h3>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-[#4b5853]">{active.explanation}</p>

          {lens !== "material" ? (
            <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(205px,.8fr)_minmax(0,1.25fr)]">
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-[.12em] text-[#64716b]">
                  Original records <span className="font-semibold normal-case tracking-normal">({sources.length})</span>
                </h4>
                <div aria-label="Original evidence documents" className="mt-3 flex snap-x gap-2 overflow-x-auto pb-2 lg:grid lg:overflow-visible lg:pb-0">
                  {sources.map(item => (
                    <button type="button" key={item.id} aria-pressed={item.id === source?.id}
                      onClick={() => setSourceId(item.id)}
                      className={"w-[210px] shrink-0 snap-start rounded-[12px] border-2 px-3.5 py-3 text-left transition-colors lg:w-full focus-visible:outline-2 focus-visible:outline-[#2b31d8] " +
                        (item.id === source?.id ? "border-[#2b31d8] bg-[#eef0ff]" : "border-[#e2e5e3] bg-white hover:border-[#aeb3b5]")}>
                      <span className="block text-[11px] font-black tracking-[.04em] text-[#2b31d8]">{item.identifier}</span>
                      <span className="mt-1 block text-[12px] font-semibold leading-5 text-[#28332e]">{item.label}</span>
                      <span className="mt-1.5 block text-[10px] font-medium text-[#667771]">{kindLabel(item)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {source && (
                <section aria-label="Selected original source" className="min-w-0 self-start overflow-hidden rounded-[16px] border-2 border-[#111214] bg-[#fbfbf8]">
                  <div className="border-b border-[#dedfdb] bg-white px-5 py-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#247a63]">Source inspection</p>
                    <h4 className="mt-1.5 text-lg font-extrabold tracking-[-.035em]">{source.identifier}</h4>
                    <p className="mt-1 text-xs font-semibold text-[#6a716f]">{source.publisher} · {kindLabel(source)}</p>
                  </div>
                  <div className="space-y-4 px-5 py-5">
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[#2c765a]">Documented observation</p>
                      <p className="mt-1.5 text-sm leading-6 text-[#414b46]">{source.observation}</p>
                    </div>
                    <div className="rounded-[10px] border-l-[3px] border-[#c48a41] bg-[#fff6e8] px-3.5 py-3">
                      <p className="text-[11px] font-extrabold text-[#956626]">What this does not prove</p>
                      <p className="mt-1 text-xs leading-5 text-[#776348]">{source.limitation}</p>
                    </div>
                    <a href={source.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#17191b] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-[#2b31d8]">
                      Open original record <ArrowUpRight className="size-4" />
                    </a>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border-2 border-[#bdc7c0] bg-[#f5f8f5] p-6">
              <div className="flex items-center gap-2 text-[#806143]"><ShieldAlert className="size-5" />
                <p className="text-sm font-extrabold">No authenticated physical lot on file</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#56645b]">
                Do not mistake the molecule&apos;s PubChem entry, a laboratory&apos;s general methods or
                an issuer&apos;s certificate for an independently verified sample.
              </p>
              <Link href="/intelligence/materials?subject=pexiganan"
                className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#17191b] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#2b31d8]">
                Check label and report IDs <ArrowRight className="size-4" />
              </Link>
            </div>
          )}

          {checks.length > 0 && (
            <details className="mt-6 rounded-xl border border-[#dde4e0] bg-white">
              <summary className="cursor-pointer px-4 py-3.5 text-xs font-bold text-[#306b59]">
                Read the {checks.length} underlying evidence {checks.length === 1 ? "check" : "checks"} and remaining questions
              </summary>
              <div className="divide-y divide-[#e6ebe7] border-t border-[#e1e7e3]">
                {checks.map(check => (
                  <div key={check.id} className="p-4">
                    <p className="text-sm font-bold text-[#202b25]">{check.heading}</p>
                    <p className="mt-1 text-xs leading-6 text-[#56635c]">{check.finding}</p>
                    <p className="mt-2 text-xs leading-5 text-[#895d2b]">Still to check: {check.reviewTask}</p>
                    <Link href={"/intelligence/passports/pexiganan#evidence-claim-" + check.id}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#2b31d8] hover:underline">
                      Read complete check <ArrowUpRight className="size-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <aside className="flex flex-col gap-5 border-t-2 border-[#111214] bg-[#f8f7f2] p-5 xl:border-l-2 xl:border-t-0 xl:p-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.12em] text-[#9c692e]">Limit of the finding</p>
            <p className="mt-2 text-sm leading-6 text-[#4c5850]">{active.limit}</p>
          </div>
          <div className="border-t border-[#daddd7] pt-5">
            <p className="text-[11px] font-black uppercase tracking-[.12em] text-[#267968]">Useful next check</p>
            <p className="mt-2 text-sm leading-6 text-[#4c5850]">{active.next}</p>
          </div>
          <Link href={active.contextLink}
            className="mt-auto inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border-2 border-[#111214] bg-white px-4 py-3 text-xs font-extrabold text-[#1f2b26] hover:bg-[#eafff2]">
            {active.contextLabel} <ArrowRight className="size-4 shrink-0" />
          </Link>
          <div className="border-t border-[#daddd7] pt-4 text-[11px] leading-5 text-[#68736c]">
            <p><CheckCircle2 className="mr-1 inline size-3.5 text-[#28775f]" /> Source relationships are editorially selected, not systematically reviewed.</p>
            <p className="mt-1.5">No efficacy rating, human-use guidance, seller endorsement or independently checked physical sample.</p>
            <Link href="/intelligence/grading" className="mt-3 inline-flex items-center gap-1 font-bold text-[#2b31d8] hover:underline">
              Understand the source-file score <ArrowUpRight className="size-3.5" />
            </Link>
            <Link href="/intelligence/passports/pexiganan"
              className="mt-2 flex items-center gap-1 font-bold text-[#2b31d8] hover:underline">
              All six evidence checks <FileSearch className="size-3.5" />
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
