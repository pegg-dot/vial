"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowRight, ArrowUpRight, CheckCircle2,
  Download, FileSearch, FlaskConical, Search, ShieldQuestion,
} from "lucide-react";
import {
  RESEARCH_SUBJECTS, researchSubjectBySlug, researchThemeById,
} from "@/lib/research-explorer";
import { ResearchSubjectArt } from "@/components/intelligence/research-subject-art";
import {
  MATERIAL_EVIDENCE_REQUIREMENTS,
  evaluateLotMatch, isSafeResearchSourceUrl, materialReviewWorkpaper,
  type MaterialReviewDraft,
} from "@/lib/research-materials";

const initialDraft = {
  sampleLabel: "", sampleLot: "", reportLot: "",
  reportIssuer: "", reportUrl: "", reviewerNote: "",
};

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
    <div className="space-y-9">
      <section id="material-workpaper" aria-labelledby="material-workpaper-title" className="scroll-mt-36 overflow-hidden rounded-[22px] border-2 border-[#17191b] bg-white">
        <div className="grid border-b-2 border-[#17191b] bg-[#dcfae9] lg:grid-cols-[minmax(0,1fr)_245px]">
          <div className="p-6 sm:p-8">
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[#237761]"><FileSearch className="size-4" /> Sample and report checklist</p>
            <h2 id="material-workpaper-title" className="mt-3 text-2xl font-extrabold tracking-[-.05em] text-[#17191b] sm:text-3xl">{subject.name} material file</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#537061]">
              Compare IDs from a sample label and a report you already have. This checks only what you type, not whether the report or sample is authentic. Nothing is uploaded or saved.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
              <button type="button" onClick={() => {
                const index = document.getElementById("material-index");
                if (index instanceof HTMLDetailsElement) {
                  index.open = true;
                  index.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }} className="inline-flex min-h-6 items-center gap-1 text-xs font-extrabold text-[#245c4c] underline underline-offset-4">
                Choose another compound <ArrowRight className="size-3.5" />
              </button>
              <Link href={"/intelligence/explore/" + slug} className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#245c4c] underline underline-offset-4">Scientific dossier <ArrowUpRight className="size-3.5" /></Link>
              <a href={subject.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#245c4c] underline underline-offset-4">Original identity source <ArrowUpRight className="size-3.5" /></a>
            </div>
          </div>
          <div className="grid place-items-center border-t-2 border-[#17191b] p-6 lg:border-l-2 lg:border-t-0">
            <div className="text-center">
              <ShieldQuestion className="mx-auto size-11 text-[#6b856c]" />
              <p className="mt-2 text-2xl font-black text-[#1f3f30]">Unverified</p>
              <p className="mt-1 text-xs leading-5 text-[#547160]">No physical sample or certificate has been authenticated</p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <h3 className="text-lg font-extrabold text-[#1b2921]">Compare the lot and report</h3>
            <p className="mt-2 text-xs leading-6 text-[#68776d]">Enter observations from a material label and a report you already possess. This tool checks only the typed lot identifiers; it cannot validate original documents.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {([
                ["sampleLabel", "Material label", "As written on the sample"],
                ["sampleLot", "Sample lot ID", "Exact ID from the label"],
                ["reportLot", "Report lot ID", "Exact ID from the report"],
                ["reportIssuer", "Report issuer", "Name on the document"],
                ["reportUrl", "Source report URL (optional)", "https://…"],
              ] as const).map(([field, label, placeholder]) => (
                <label key={field} className={field === "reportUrl" ? "block sm:col-span-2" : "block"}>
                  <span className="mb-1.5 block text-xs font-bold text-[#31483a]">{label}</span>
                  <input value={draft[field]} onChange={event => update(field, event.target.value)}
                    placeholder={placeholder} autoComplete="off" maxLength={180}
                    className="h-11 w-full rounded-lg border border-[#ccdcd0] bg-white px-3 text-sm text-[#182a1d] focus:border-[#168e7f] focus:outline-2 focus:outline-offset-1 focus:outline-[#168e7f]" />
                </label>
              ))}
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-bold text-[#31483a]">Reviewer&apos;s notes (optional)</span>
                <textarea value={draft.reviewerNote} onChange={event => update("reviewerNote", event.target.value)}
                  rows={3} maxLength={500} placeholder="What is missing, contradictory, or needs issuer confirmation?"
                  className="w-full rounded-lg border border-[#ccdcd0] bg-white px-3 py-3 text-sm text-[#182a1d] focus:border-[#168e7f] focus:outline-2 focus:outline-offset-1 focus:outline-[#168e7f]" />
              </label>
            </div>
            <div role="status" aria-live="polite" className={"mt-5 flex items-start gap-2 rounded-xl border p-4 text-sm font-semibold leading-6 " +
              (lotMatch === "conflict" ? "border-[#ecc0ab] bg-[#fff2e9] text-[#95502d]" :
                lotMatch === "literal-match" ? "border-[#b6dcc7] bg-[#f0fbf4] text-[#2f6650]" :
                  "border-[#eadcbb] bg-[#fff9ed] text-[#816335]")}>
              {lotMatch === "literal-match" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
              <div>
                <strong>Lot check: </strong>{lotMessage}
                {draft.reportUrl.trim() && !isSafeResearchSourceUrl(draft.reportUrl.trim()) &&
                  <p className="mt-1 text-xs font-normal">The report reference must be an HTTPS URL to appear in the exported notes.</p>}
              </div>
            </div>
            <button type="button" onClick={downloadWorkpaper}
              className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#17191b] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#383b3a]">
              <Download className="size-4" /> Download provisional workpaper
            </button>
            <p className="mt-2 text-[11px] leading-5 text-[#839187]">The file always states UNVERIFIED, even when typed lot IDs match. It includes every unanswered evidence requirement.</p>
          </div>
          <aside aria-label="Required material evidence checks" className="rounded-2xl border border-[#d5e2d9] bg-[#f8fbf8] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-[#256a56]"><FlaskConical className="size-5" /><h3 className="text-base font-extrabold">What would need verification?</h3></div>
            <p className="mt-2 text-xs leading-6 text-[#697970]">Five separate checks. None of these are established by a molecular literature grade or a vendor&apos;s generic QC webpage.</p>
            <ol className="mt-5 space-y-4">
              {MATERIAL_EVIDENCE_REQUIREMENTS.map((check, index) => (
                <li key={check.id} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#d6dfd7] bg-white text-xs font-extrabold text-[#64766b]">{index + 1}</span>
                  <div>
                    <p className="text-sm font-bold text-[#2e4539]">{check.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#65786c]">{check.question}</p>
                    <p className="mt-1 text-[11px] leading-5 text-[#8b918c]">{check.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-[#d5e2d9] pt-4 text-xs font-extrabold text-[#7f6d49]">No independent laboratory confirmation on file.</p>
          </aside>
        </div>
      </section>

      <details id="material-index" className="scroll-mt-36 overflow-hidden rounded-[20px] border-2 border-[#17191b] bg-white">
        <summary className="cursor-pointer bg-[#eefaf3] px-5 py-5 text-sm font-extrabold text-[#205b49] hover:bg-[#e2f8ed] sm:px-7">
          Choose another compound <span className="ml-2 font-medium text-[#5f776b]">· All 16 identities</span>
        </summary>
        <div className="border-t border-[#dbe7df] p-5 sm:p-7">
      <section aria-label="Research material identity index">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.13em] text-[#198779]">Research material index</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-.045em] text-[#17191b]">Choose a different compound</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#68776c]">
              These are scientific identity references, not listings of available material. No indexed identity has an independently authenticated physical lot on file yet.
            </p>
          </div>
          <span className="rounded-full border border-[#e4d9bb] bg-[#fff7df] px-3 py-2 text-xs font-extrabold text-[#8b6a35]">0 authenticated lots</span>
        </div>
        <label className="relative mt-5 block max-w-lg">
          <span className="sr-only">Search material identities</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#718076]" />
          <input type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Search compound, research family or alias…"
            className="h-12 w-full rounded-xl border-2 border-[#d0dcd5] bg-white pl-11 pr-4 text-sm focus:border-[#1c8875] focus:outline-none" />
        </label>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map(record => {
            const theme = researchThemeById(record.theme);
            return (
              <article key={record.slug} className={"min-w-0 overflow-hidden rounded-[17px] border-2 bg-white shadow-[3px_4px_0_rgba(23,25,27,0.09)] " +
                (slug === record.slug ? "border-[#148675]" : "border-[#17191b]")}>
                <div className="relative h-24 overflow-hidden">
                  <ResearchSubjectArt subject={record} compact />
                </div>
                <div className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[.08em]" style={{ color: theme.color }}>{theme.name}</p>
                  <h3 className="mt-1 text-lg font-extrabold tracking-[-.04em] text-[#17191b]">{record.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#63746b]">Material evidence not verified</p>
                  <button type="button" aria-pressed={slug === record.slug} onClick={() => selectSubject(record.slug)}
                    aria-label={"Review " + record.name + " material evidence"}
                    className={"mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-xs font-extrabold " +
                      (slug === record.slug ? "bg-[#c6f3dc] text-[#1a5644]" : "bg-[#17191b] text-white hover:bg-[#343839]")}>
                    {slug === record.slug ? "Selected for review" : "Review material file"} <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
          {filtered.length === 0 && <p role="status" className="col-span-full rounded-xl border bg-white p-6 text-sm">No matched research identities. Try another name or alias.</p>}
        </div>
      </section>
        </div>
      </details>
    </div>
  );
}
