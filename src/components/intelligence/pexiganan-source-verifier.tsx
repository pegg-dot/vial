"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Search, ShieldAlert } from "lucide-react";
import { normalizeNctId } from "@/lib/nct-identifier";
import { PEXIGANAN_CLAIMS, PEXIGANAN_SOURCES, pexSourceByIdentifier } from "@/lib/pexiganan-evidence-network";
import { Chip, Frame, Notice, Pill, Quiet, RecordList, UI } from "@/components/intelligence/research-ui";

const SAMPLES = ["PMID 36781451", "PMID 18990064", "NCT01594762", "CID 16132253"] as const;

/** An allowlisted source-identifier check. No arbitrary vendor names,
 * documents, uploads, URLs, history persistence, or third-party fetch.
 * This lookup confirms presence in the curated evidence passport only. */
export function PexSourceVerifier({ initialRef = "" }: { initialRef?: string }) {
  const [query, setQuery] = useState(initialRef);
  const [checked, setChecked] = useState(initialRef.trim());
  // A pasted ClinicalTrials.gov study link means its NCT number; everything else is matched as typed.
  const linkedNct = normalizeNctId(checked);
  const identifier = linkedNct && linkedNct !== checked.trim().toUpperCase() ? linkedNct : checked;
  const source = pexSourceByIdentifier(identifier);
  const related = source
    ? PEXIGANAN_CLAIMS.filter(claim => claim.sourceIds.includes(source.id))
    : [];
  const isEmpty = checked.trim().length === 0;
  const wellFormed = /^(?:NCT\d{8}|(?:PMID|CID)\s?\d{1,10}|\d{5,10})$/i.test(identifier.trim());
  const liveNct = normalizeNctId(identifier);
  // Records that share an observation with this one, so the relationship can be walked in place.
  const neighbours = source
    ? [...new Set(related.flatMap(claim => claim.sourceIds))]
        .filter(id => id !== source.id)
        .flatMap(id => PEXIGANAN_SOURCES.filter(item => item.id === id))
    : [];

  // A checked identifier lives in the address so the result can be shared, reloaded and reached with Back.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (checked) url.searchParams.set("ref", checked); else url.searchParams.delete("ref");
      window.history.replaceState(null, "", url.pathname + url.search);
    } catch { /* ignore */ }
  }, [checked]);

  // The region keeps its fixed, tested name rather than the h2's, so the numbered header is composed
  // here instead of through NumberedSection (which names its section after the heading).
  return (
    <Frame as="section" ariaLabel="Original research source verification" shadow="sm" pad="none" radius="rounded-[16px]" className="scroll-mt-36 overflow-hidden">
      <header className="border-b-2 border-[#111214] px-5 py-3.5">
        <p className="text-[10.5px] font-extrabold uppercase tracking-[.16em] text-[#2b31d8]">
          <span className="font-mono">01</span> · Source check · {PEXIGANAN_SOURCES.length} public identifiers
        </p>
        <h2 className="mt-1 text-balance text-[clamp(1.125rem,1.6vw,1.375rem)] font-extrabold leading-[1.15] tracking-[-.03em] text-[#111214]">Paste an exact source identifier.</h2>
      </header>

      {/* Form on the left, result on the right, so a returned limitation is on screen without scrolling. */}
      <div className="grid lg:grid-cols-2">
        <div className="border-b-2 border-[#111214]/10 px-5 py-5 lg:border-b-0 lg:border-r-2">
          <p className={UI.body}>
            Check whether an NCT, PMID or PubChem CID is in the source register, what type of evidence it provides, and what it cannot prove.
          </p>
          <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={event => {
            event.preventDefault();
            setChecked(query.trim().slice(0, 80));
          }}>
            <label htmlFor="research-source-id" className="sr-only">Exact NCT, PMID or CID</label>
            <input id="research-source-id" name="source" type="text" autoComplete="off"
              maxLength={80} value={query} onChange={event => setQuery(event.target.value)}
              placeholder="Try PMID 36781451 or NCT01594762" className={UI.field + " sm:flex-1"} />
            <Pill type="submit" variant="primary" arrow="right" className="shrink-0 sm:min-h-[3.25rem]">Check record</Pill>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={UI.small + " font-extrabold"}>Try:</span>
            {SAMPLES.map(id => (
              <Pill key={id} size="sm" variant="ghost" onClick={() => { setQuery(id); setChecked(id); }}>{id}</Pill>
            ))}
          </div>
          <div className="mt-5 flex items-start gap-2 border-t border-[#111214]/15 pt-4">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#9b6b22]" aria-hidden="true" />
            <div>
              <p className={UI.small}>
                The checker matches IDs against a bounded, editorially curated source register. It does not authenticate documents, review all articles, certify outcomes, or collect saved research histories. External source records can change and must be inspected directly.
              </p>
              <p className={UI.small + " mt-1"}>{PEXIGANAN_SOURCES.length} public identifiers · No files uploaded or marketplace requests</p>
            </div>
          </div>
        </div>

        <div aria-live="polite" className="min-w-0 px-5 py-5">
          {isEmpty ? (
            <Quiet className="flex items-start gap-3">
              <Search className="mt-0.5 size-5 shrink-0 text-[#2b31d8]" aria-hidden="true" />
              <p className={UI.body}>Choose a sample identifier or enter an exact record ID. Only the {PEXIGANAN_SOURCES.length} manually selected public records in this evidence pilot are included.</p>
            </Quiet>
          ) : !source ? (
            <Frame tone="warn" thin shadow="none" radius="rounded-[14px]" pad="sm">
              <div className="flex items-center gap-2">
                <CircleAlert className="size-5 shrink-0 text-[#9b6b22]" aria-hidden="true" />
                <h3 className={UI.h4}>{wellFormed ? "Not checked in this evidence file" : "Not a recognised identifier format"}</h3>
              </div>
              <p className={UI.bodyInk + " mt-2"}>
                {wellFormed
                  ? "We have no individually selected record for this exact identifier in the Pexiganan pilot. This does not mean the record is false, invalid, irrelevant or absent from the source database."
                  : "This is not an NCT number, PMID or PubChem CID, so nothing was looked up. VialGrade cannot check names, claims, vendors or free text here."}
              </p>
              {liveNct && (
                <Pill href={"/intelligence/studies/" + liveNct} variant="ink" size="sm" arrow="right" className="mt-4">
                  Look up {liveNct} live on ClinicalTrials.gov
                </Pill>
              )}
              <p className={UI.small + " mt-3"}>Supported here: exact NCT12345678, PMID 12345678 or CID 12345678 formats. Please check unfamiliar identifiers at the original NIH source.</p>
            </Frame>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="mint" icon={CheckCircle2}>Selected record found in file</Chip>
                <Chip>{source.kind.replaceAll("-", " ")}</Chip>
              </div>
              <h3 className={UI.h3 + " mt-4 break-words leading-6"}>{source.identifier} · {source.label}</h3>
              <p className={UI.bodyInk + " mt-2"}>{source.observation}</p>
              <Notice tone="warn" title="Important limitation" className="mt-4">
                <p>{source.limitation}</p>
              </Notice>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill href={source.url} external variant="ink" size="sm" arrow="up">
                  Open original {source.publisher.split(" / ")[0]} record
                </Pill>
                <Pill href="/intelligence/passports/pexiganan" variant="ghost" size="sm" arrow="right">Research evidence passport</Pill>
              </div>
              {neighbours.length > 0 && (
                <div className="mt-5 border-t border-[#111214]/15 pt-4">
                  <p className={UI.eyebrowMuted}>Other records cited in the same observation</p>
                  <p className={UI.small + " mt-1"}>Being cited together is a bibliographic link, not proof that one reports the other&apos;s results.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {neighbours.map(item => (
                      <Pill key={item.id} size="sm" variant="ghost" onClick={() => { setQuery(item.identifier); setChecked(item.identifier); }}>
                        Check {item.identifier}
                      </Pill>
                    ))}
                  </div>
                </div>
              )}
              {related.length > 0 && (
                <div className="mt-5 border-t border-[#111214]/15 pt-4">
                  <p className={UI.eyebrowMuted}>Connected evidence question{related.length === 1 ? "" : "s"}</p>
                  <RecordList className="mt-2" items={related.map(claim => ({
                    href: "/intelligence/passports/pexiganan#evidence-claim-" + claim.id,
                    title: claim.heading,
                    action: "Open in the passport",
                  }))} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Frame>
  );
}
