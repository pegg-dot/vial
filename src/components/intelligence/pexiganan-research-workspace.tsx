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
import { Chip, Notice, Pill, UI } from "@/components/intelligence/research-ui";

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
    deskTopic: "identity",
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
    deskTopic: "identity",
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
    deskTopic: "clinical-trials",
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
    deskTopic: null,
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
  deskTopic: "identity" | "clinical-trials" | null;
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
      className="ink hard scroll-mt-32 overflow-hidden rounded-[18px] bg-white">
      <div className="border-b-2 border-[#111214] bg-[#e6fbf6] px-5 py-6 sm:px-8 sm:py-7">
        <p className={UI.eyebrow}>Pexiganan · guided evidence inspection</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl">
            <h2 id="research-workspace-title" className={UI.h2 + " max-w-[18ch]"}>
              One compound. Four different evidence questions.
            </h2>
            <p className={UI.body + " mt-3 max-w-2xl"}>
              Choose what you want to investigate. Then inspect the exact source and what it cannot establish,
              without leaving the research file.
            </p>
          </div>
          <Chip tone="mint">Editorial sources checked {PEXIGANAN_REVIEW_DATE}</Chip>
        </div>
      </div>

      <div role="group" aria-label="Select evidence question" className="grid grid-cols-2 gap-px border-b-2 border-[#111214] bg-[#111214]/15 sm:grid-cols-4">
        {LENSES.map(item => {
          const Icon = item.icon;
          const selected = lens === item.key;
          return (
            <button type="button" key={item.key} aria-pressed={selected}
              aria-label={"Investigate " + item.label}
              onClick={() => chooseLens(item.key)}
              className={"min-h-[104px] p-3 text-left outline-offset-[-4px] transition-colors focus-visible:outline-2 focus-visible:outline-[#2b31d8] sm:min-h-[118px] sm:p-5 " +
                (selected ? "bg-[#2b31d8] text-white" : "bg-white text-[#111214] hover:bg-[#eef0ff]")}>
              <div className="flex items-center justify-between gap-1">
                <span className={"text-[10px] font-extrabold tracking-[.1em] " + (selected ? "text-white/70" : "text-[#4a4d56]")}>{item.number}</span>
                <Icon className={"size-5 " + (selected ? "text-white" : "text-[#2b31d8]")} aria-hidden="true" />
              </div>
              <span className="mt-2 block text-[13px] font-extrabold leading-5 sm:text-sm">{item.label}</span>
              <span className={"mt-1 block text-[11px] font-medium leading-4 " + (selected ? "text-white/80" : "text-[var(--muted)]")}>{item.short}</span>
            </button>
          );
        })}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 p-5 sm:p-8" aria-live="polite">
          <p className={UI.eyebrow}>What the record shows · {active.number}/04</p>
          <h3 className="mt-2 text-balance text-[clamp(1.5rem,2.6vw,2rem)] font-extrabold leading-tight tracking-[-.04em] text-[#111214]">{active.title}</h3>
          <p className={UI.bodyInk + " mt-3 max-w-2xl leading-7"}>{active.explanation}</p>

          {lens !== "material" ? (
            <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(205px,.8fr)_minmax(0,1.25fr)]">
              <div className="min-w-0">
                <h4 className={UI.eyebrowMuted}>
                  Original records <span className="font-semibold normal-case tracking-normal">({sources.length})</span>
                </h4>
                <div role="group" aria-label="Original evidence documents" className="mt-3 flex snap-x gap-2 overflow-x-auto pb-2 lg:grid lg:overflow-visible lg:pb-0">
                  {sources.map(item => (
                    <button type="button" key={item.id} aria-pressed={item.id === source?.id}
                      onClick={() => setSourceId(item.id)}
                      className={"w-[210px] shrink-0 snap-start rounded-[12px] px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b31d8] lg:w-full " +
                        (item.id === source?.id ? "ink bg-[#eef0ff]" : "ink-1 bg-white hover:bg-[#eef0ff]")}>
                      <span className="block text-[11px] font-extrabold tracking-[.04em] text-[#2b31d8]">{item.identifier}</span>
                      <span className="mt-1 block text-xs font-bold leading-5 text-[#111214]">{item.label}</span>
                      <span className="mt-1.5 block text-[10px] font-medium text-[var(--muted)]">{kindLabel(item)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {source && (
                <section aria-label="Selected original source" className="min-w-0 self-start overflow-hidden rounded-[14px] border border-[#111214]/15 bg-[#fbfbf8]">
                  <div className="border-b border-[#111214]/15 bg-white px-5 py-4">
                    <p className={UI.eyebrowMuted}>Source inspection</p>
                    <h4 className={UI.h3 + " mt-1.5 break-words"}>{source.identifier}</h4>
                    <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{source.publisher} · {kindLabel(source)}</p>
                  </div>
                  <div className="space-y-4 px-5 py-5">
                    <div>
                      <p className={UI.eyebrowMuted}>Documented observation</p>
                      <p className={UI.bodyInk + " mt-1.5"}>{source.observation}</p>
                    </div>
                    <Notice tone="warn" title="What this does not prove">
                      <p className="text-xs leading-5">{source.limitation}</p>
                    </Notice>
                    <Pill href={source.url} external variant="ink" size="sm" arrow="up">Open original record</Pill>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <Notice tone="warn" icon={ShieldAlert} className="mt-6">
              <p className="font-extrabold">No authenticated physical lot on file</p>
              <p className="mt-1 text-xs leading-5">
                Do not mistake the molecule&apos;s PubChem entry, a laboratory&apos;s general methods or
                an issuer&apos;s certificate for an independently verified sample.
              </p>
              <Pill href="/intelligence/materials?subject=pexiganan" variant="ink" size="sm" arrow="right" className="mt-3">Check label and report IDs</Pill>
            </Notice>
          )}

          {checks.length > 0 && (
            <details className="group mt-6 overflow-hidden rounded-[14px] border border-[#111214]/15 bg-white">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-extrabold text-[#111214] hover:bg-[#eef0ff] [&::-webkit-details-marker]:hidden">
                Read the {checks.length} underlying evidence {checks.length === 1 ? "check" : "checks"} and remaining questions
                <ArrowRight className="size-4 shrink-0 text-[#2b31d8] transition-transform group-open:rotate-90" aria-hidden="true" />
              </summary>
              <div className="divide-y divide-[#111214]/10 border-t border-[#111214]/15">
                {checks.map(check => (
                  <div key={check.id} className="p-4">
                    <p className="text-sm font-extrabold text-[#111214]">{check.heading}</p>
                    <p className={UI.small + " mt-1"}>{check.finding}</p>
                    <p className="mt-2 text-xs font-medium leading-5 text-[#9b6b22]">Still to check: {check.reviewTask}</p>
                    <Link href={"/intelligence/passports/pexiganan#evidence-claim-" + check.id} className={UI.linkSmall + " mt-2"}>
                      Read complete check <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <aside className="flex flex-col gap-5 border-t-2 border-[#111214] bg-[var(--background)] p-5 xl:border-l-2 xl:border-t-0 xl:p-6">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#9b6b22]">Limit of the finding</p>
            <p className={UI.bodyInk + " mt-2"}>{active.limit}</p>
          </div>
          <div className="border-t border-[#111214]/15 pt-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0b6b60]">Useful next check</p>
            <p className={UI.bodyInk + " mt-2"}>{active.next}</p>
          </div>
          <Pill href={active.contextLink} variant="secondary" size="sm" arrow="right" className="mt-auto w-full">{active.contextLabel}</Pill>
          {active.deskTopic && (
            <Pill href={"/intelligence/desk?topic=" + active.deskTopic} variant="ink" size="sm" arrow="right" className="w-full">Build a source brief from this</Pill>
          )}
          <div className="border-t border-[#111214]/15 pt-4 text-[11px] font-medium leading-5 text-[var(--muted)]">
            <p><CheckCircle2 className="mr-1 inline size-3.5 text-[#0b6b60]" aria-hidden="true" /> Source relationships are editorially selected, not systematically reviewed.</p>
            <p className="mt-1.5">No efficacy rating, human-use guidance, seller endorsement or independently checked physical sample.</p>
            <Link href="/intelligence/grading" className={UI.linkSmall + " mt-3"}>
              Understand the source-file score <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
            <Link href="/intelligence/passports/pexiganan" className={UI.linkSmall + " mt-2 flex"}>
              All six evidence checks <FileSearch className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
