"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FlaskConical, ShieldQuestion } from "lucide-react";
import {
  RESEARCH_SUBJECTS, researchSubjectBySlug, researchThemeById,
} from "@/lib/research-explorer";
import { ResearchSubjectArt } from "@/components/intelligence/research-subject-art";
import {
  MATERIAL_EVIDENCE_REQUIREMENTS,
  evaluateLotMatch, isSafeResearchSourceUrl, materialReviewWorkpaper,
  type MaterialReviewDraft,
} from "@/lib/research-materials";
import { Chip, Frame, Notice, NumberedSection, Pill, Quiet, UI } from "@/components/intelligence/research-ui";

const initialDraft = {
  sampleLabel: "", sampleLot: "", reportLot: "",
  reportIssuer: "", reportUrl: "", reviewerNote: "",
};

const FIELDS = [
  ["sampleLabel", "Material label", "As written on the sample"],
  ["sampleLot", "Sample lot ID", "Exact ID from the label"],
  ["reportLot", "Report lot ID", "Exact ID from the report"],
  ["reportIssuer", "Report issuer", "Name on the document"],
  ["reportUrl", "Source report URL (optional)", "https://…"],
] as const;

export function MaterialReviewWorkbench({ initialSlug }: { initialSlug: string }) {
  const [slug, setSlug] = useState(researchSubjectBySlug(initialSlug) ? initialSlug : "pexiganan");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(initialDraft);
  const subject = researchSubjectBySlug(slug)!;
  const lotMatch = evaluateLotMatch(draft.sampleLot, draft.reportLot);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RESEARCH_SUBJECTS.filter(record => !q || [
      record.name, record.family, record.theme, ...record.alternativeNames,
    ].some(value => value.toLowerCase().includes(q)));
  }, [query]);

  const lotMessage =
    lotMatch === "literal-match" ? "Typed identifiers match. Authenticity still unverified."
    : lotMatch === "conflict" ? "Conflict: sample and report lot identifiers differ."
    : lotMatch === "no-lot-data" ? "No lot-level records entered."
    : lotMatch === "report-lot-missing" ? "A report lot identifier is missing."
    : "A sample lot identifier is missing.";

  function selectSubject(next: string) {
    if (!researchSubjectBySlug(next)) return;
    setSlug(next);
    setDraft(initialDraft);
    document.getElementById("material-workpaper")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openIndex() {
    const index = document.getElementById("material-index");
    if (index instanceof HTMLDetailsElement) {
      index.open = true;
      index.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function update(field: keyof typeof initialDraft, value: string) {
    setDraft(old => ({ ...old, [field]: value.slice(0, field === "reviewerNote" ? 500 : 180) }));
  }

  function downloadWorkpaper() {
    const review: MaterialReviewDraft = { subjectSlug: slug, ...draft };
    const markdown = materialReviewWorkpaper(review, new Date().toISOString().slice(0, 10));
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const element = document.createElement("a");
    element.href = url;
    element.download = "vialgrade-" + slug + "-material-review-unverified.md";
    element.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="grid gap-4">
      <NumberedSection id="material-workpaper" number={1} eyebrow="Sample and report checklist" titleId="material-workpaper-title"
        title={subject.name + " material file"}
        intro="Compare IDs from a sample label and a report you already have. This checks only what you type, not whether the report or sample is authentic. No physical sample or certificate has been authenticated. Nothing is uploaded or saved."
        chips={<Chip tone="warn" icon={ShieldQuestion}>Unverified</Chip>}
        actions={<>
          <Pill size="sm" variant="ghost" onClick={openIndex}>Choose another compound</Pill>
          <Pill size="sm" variant="ghost" href={"/intelligence/explore/" + slug} arrow="right">Scientific dossier</Pill>
          <Pill size="sm" variant="ghost" href={subject.referenceUrl} external arrow="up">Original identity source</Pill>
        </>}>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div className="min-w-0">
            <h3 className={UI.h3}>Compare the lot and report</h3>
            <p className={UI.small + " mt-2"}>Enter observations from a material label and a report you already possess. This tool checks only the typed lot identifiers; it cannot validate original documents.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {FIELDS.map(([field, label, placeholder]) => (
                <label key={field} className={field === "reportUrl" ? "block sm:col-span-2" : "block"}>
                  <span className="mb-1.5 block text-xs font-extrabold text-[#111214]">{label}</span>
                  <input value={draft[field]} onChange={event => update(field, event.target.value)}
                    placeholder={placeholder} autoComplete="off" maxLength={180} className={UI.field} />
                </label>
              ))}
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-extrabold text-[#111214]">Reviewer&apos;s notes (optional)</span>
                <textarea value={draft.reviewerNote} onChange={event => update("reviewerNote", event.target.value)}
                  rows={3} maxLength={500} placeholder="What is missing, contradictory, or needs issuer confirmation?" className={UI.field} />
              </label>
            </div>
            {/* The page's one live status: tone says conflict (danger), literal match (mint) or missing data (warn). */}
            <Notice role="status" live="polite" className="mt-4"
              tone={lotMatch === "conflict" ? "danger" : lotMatch === "literal-match" ? "mint" : "warn"}
              icon={lotMatch === "literal-match" ? CheckCircle2 : AlertCircle}>
              <p><span className="font-extrabold">Lot check: </span>{lotMessage}</p>
              {draft.reportUrl.trim() && !isSafeResearchSourceUrl(draft.reportUrl.trim()) &&
                <p className="mt-1 text-xs leading-5">The report reference must be an HTTPS URL to appear in the exported notes.</p>}
            </Notice>
            <Pill variant="ink" icon={Download} onClick={downloadWorkpaper} className="mt-4">Download provisional workpaper</Pill>
            <p className={UI.small + " mt-2"}>The file always states UNVERIFIED, even when typed lot IDs match. It includes every unanswered evidence requirement.</p>
          </div>

          <Frame as="aside" ariaLabel="Required material evidence checks" tone="paper" thin shadow="none" radius="rounded-[14px]" pad="sm" className="min-w-0 self-start">
            <div className="flex items-center gap-2">
              <FlaskConical className="size-5 text-[#2b31d8]" aria-hidden="true" />
              <h3 className={UI.h4}>What would need verification?</h3>
            </div>
            <p className={UI.small + " mt-2"}>Five separate checks. None of these are established by a molecular literature grade or a vendor&apos;s generic QC webpage.</p>
            <ol className="mt-4 space-y-4">
              {MATERIAL_EVIDENCE_REQUIREMENTS.map((check, index) => (
                <li key={check.id} className="flex gap-3">
                  <span className="ink-1 grid size-7 shrink-0 place-items-center rounded-full bg-white font-mono text-xs font-extrabold text-[#2b31d8]">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-[#111214]">{check.title}</p>
                    <p className={UI.small + " mt-1"}>{check.question}</p>
                    <p className="mt-1 text-[11px] font-medium leading-5 text-[#4a4d56]">{check.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-[#111214]/15 pt-3 text-xs font-extrabold text-[#9b6b22]">No independent laboratory confirmation on file.</p>
          </Frame>
        </div>
      </NumberedSection>

      {/* Starts closed: the chooser is the second step, reached by the button above or by opening it here. */}
      <details id="material-index" className="ink hard-sm scroll-mt-36 overflow-hidden rounded-[16px] bg-white">
        <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold text-[#111214] hover:bg-[#eef0ff]">
          Browse all {RESEARCH_SUBJECTS.length} research identities <span className={UI.small + " ml-1 inline"}>· open the index</span>
        </summary>
        <section aria-label="Research material identity index" className="border-t-2 border-[#111214] px-5 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className={UI.eyebrow}>Research material index</p>
              <h2 className={UI.h3 + " mt-2"}>Choose a different compound</h2>
              <p className={UI.body + " mt-1 max-w-2xl"}>
                These are scientific identity references, not listings of available material. No indexed identity has an independently authenticated physical lot on file yet.
              </p>
            </div>
            <Chip tone="warn">0 authenticated lots</Chip>
          </div>
          <label className="mt-4 block max-w-lg">
            <span className="sr-only">Search material identities</span>
            <input type="search" value={query} onChange={event => setQuery(event.target.value)}
              placeholder="Search compound, research family or alias…" className={UI.field} />
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map(record => {
              const theme = researchThemeById(record.theme);
              const selected = slug === record.slug;
              return (
                <Frame as="article" key={record.slug} tone={selected ? "blue" : "white"} thin={!selected} shadow={selected ? "sm" : "none"}
                  pad="none" radius="rounded-[16px]" className="min-w-0 overflow-hidden">
                  <div className="relative h-24 overflow-hidden">
                    <ResearchSubjectArt subject={record} compact />
                  </div>
                  <div className="p-4">
                    <p className={UI.eyebrowMuted}>{theme.name}</p>
                    <h3 className={UI.h4 + " mt-1"}>{record.name}</h3>
                    <p className={UI.small + " mt-1"}>Material evidence not verified</p>
                    <Pill size="sm" variant={selected ? "mint" : "ink"} arrow="right" className="mt-3 w-full"
                      ariaPressed={selected} ariaLabel={"Review " + record.name + " material evidence"} onClick={() => selectSubject(record.slug)}>
                      {selected ? "Selected for review" : "Review material file"}
                    </Pill>
                  </div>
                </Frame>
              );
            })}
            {filtered.length === 0 && (
              <Quiet className="col-span-full"><p className={UI.body}>No matched research identities. Try another name or alias.</p></Quiet>
            )}
          </div>
        </section>
      </details>
    </div>
  );
}
