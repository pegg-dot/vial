"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2, CircleAlert, Search, ShieldAlert } from "lucide-react";
import { normalizeNctId } from "@/lib/nct-identifier";
import { PEXIGANAN_CLAIMS, PEXIGANAN_SOURCES, pexSourceByIdentifier } from "@/lib/pexiganan-evidence-network";

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
  return (
    <section aria-label="Original research source verification" className="overflow-hidden rounded-[20px] border-2 border-[#17191b] bg-white">
      <div className="border-b-2 border-[#17191b] bg-[#eafff2] p-5 sm:p-7">
        <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[#267765]">Source identity check · Pilot evidence network</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-[-.045em]">Paste an exact source identifier.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#597367]">
          Check whether an NCT, PMID or PubChem CID is in the source register, what type of evidence it provides, and what it cannot prove.
          This is not a COA, supplier or clinical-benefit verifier.
        </p>
        <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={event => {
          event.preventDefault();
          setChecked(query.trim().slice(0, 80));
        }}>
          <label htmlFor="research-source-id" className="sr-only">Exact NCT, PMID or CID</label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#64776d]" aria-hidden="true" />
            <input id="research-source-id" name="source" type="text" autoComplete="off"
              maxLength={80} value={query} onChange={event => setQuery(event.target.value)}
              placeholder="Try PMID 36781451 or NCT01594762"
              className="min-h-12 w-full rounded-xl border-2 border-[#17191b] bg-white py-3 pl-11 pr-4 text-sm text-[#1f2a25] placeholder:text-[#879891] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#188d76]" />
          </div>
          <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#17191b] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#304a3f]">
            Check record <ArrowRight className="size-4" />
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#5d776b]">Try:</span>
          {(["PMID 36781451", "PMID 18990064", "NCT01594762", "CID 16132253"] as const).map(id => (
            <button key={id} type="button" onClick={() => { setQuery(id); setChecked(id); }}
              className="rounded-full border border-[#a3cbbb] bg-white px-3 py-2 text-[11px] font-bold text-[#2e6b59] hover:bg-[#effff6]">{id}</button>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="min-h-[185px] p-5 sm:p-7">
        {isEmpty ? (
          <div className="flex items-start gap-3">
            <Search className="mt-0.5 size-5 shrink-0 text-[#698575]" />
            <p className="text-sm leading-7 text-[#64746e]">Choose a sample identifier or enter an exact record ID. Only the 10 manually selected public records in this evidence pilot are included.</p>
          </div>
        ) : !source ? (
          <div className="rounded-xl border border-[#ead9ba] bg-[#fffbf2] p-5">
            <div className="flex items-center gap-2 text-[#886834]"><CircleAlert className="size-5" /><h3 className="text-base font-bold">{wellFormed ? "Not checked in this evidence file" : "Not a recognised identifier format"}</h3></div>
            <p className="mt-2 text-sm leading-6 text-[#807261]">
              {wellFormed
                ? "We have no individually selected record for this exact identifier in the Pexiganan pilot. This does not mean the record is false, invalid, irrelevant or absent from the source database."
                : "This is not an NCT number, PMID or PubChem CID, so nothing was looked up. VialGrade cannot check names, claims, vendors or free text here."}
            </p>
            {liveNct && (
              <Link href={"/intelligence/studies/" + liveNct}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#17191b] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-[#304a3f]">
                Look up {liveNct} live on ClinicalTrials.gov <ArrowRight className="size-4" />
              </Link>
            )}
            <p className="mt-3 text-xs text-[#8f846f]">Supported here: exact NCT12345678, PMID 12345678 or CID 12345678 formats. Please check unfamiliar identifiers at the original NIH source.</p>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#e7f7ed] px-3 py-2 text-xs font-extrabold text-[#286c51]"><CheckCircle2 className="size-4" /> Selected record found in file</span>
              <span className="rounded-md border border-[#e1e6e1] px-3 py-2 text-xs font-bold text-[#68796f]">{source.kind.replaceAll("-", " ")}</span>
            </div>
            <h3 className="mt-4 text-xl font-extrabold tracking-[-.035em] text-[#23342c]">{source.identifier} · {source.label}</h3>
            <p className="mt-2 text-sm leading-6 text-[#4a6458]">{source.observation}</p>
            <div className="mt-4 rounded-lg border-l-4 border-[#d6ae65] bg-[#fff9eb] px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[.09em] text-[#946b3e]">Important limitation</p>
              <p className="mt-1 text-sm leading-6 text-[#746145]">{source.limitation}</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={source.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#17191b] px-4 py-3 text-xs font-bold text-white hover:bg-[#385448]">
                Open original {source.publisher.split(" / ")[0]} record <ArrowUpRight className="size-3.5" />
              </a>
              <Link href="/intelligence/passports/pexiganan" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#c5d4cc] px-4 py-3 text-xs font-bold text-[#2a6957] hover:bg-[#eef8f1]">
                Research evidence passport <ArrowRight className="size-3.5" />
              </Link>
            </div>
            {neighbours.length > 0 && (
              <div className="mt-5 border-t border-[#dfe5e1] pt-4">
                <p className="text-xs font-extrabold text-[#4c6158]">Other records cited in the same observation</p>
                <p className="mt-1 text-xs leading-5 text-[#6c7d73]">Being cited together is a bibliographic link, not proof that one reports the other&apos;s results.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {neighbours.map(item => (
                    <button key={item.id} type="button" onClick={() => { setQuery(item.identifier); setChecked(item.identifier); }}
                      className="min-h-10 rounded-lg border-2 border-[#cfd9d3] bg-white px-3 py-2 text-xs font-extrabold text-[#2b31d8] hover:border-[#2b31d8]">
                      Check {item.identifier}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {related.length > 0 && (
              <div className="mt-5 border-t border-[#dfe5e1] pt-4">
                <p className="text-xs font-extrabold text-[#4c6158]">Connected evidence question{related.length === 1 ? "" : "s"}</p>
                <div className="mt-2 space-y-2">
                  {related.map(claim => (
                    <Link key={claim.id} href={"/intelligence/passports/pexiganan#evidence-claim-" + claim.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-[#f4f9f6] px-3 py-3 text-xs font-semibold text-[#3c6f5a] hover:underline">
                      {claim.heading} <ArrowRight className="size-4 shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-[#e1e7e2] bg-[#f9fbf9] px-5 py-4 sm:px-7">
        <div className="flex gap-2"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#8a7d5f]" />
          <p className="text-xs leading-5 text-[#7c8980]">
            The checker matches IDs against a bounded, editorially curated source register. It does not authenticate documents, review all articles, certify outcomes, or collect saved research histories. External source records can change and must be inspected directly.
          </p>
        </div>
        <p className="mt-2 text-[11px] text-[#9da8a0]">{PEXIGANAN_SOURCES.length} public identifiers · No files uploaded or marketplace requests</p>
      </div>
    </section>
  );
}
