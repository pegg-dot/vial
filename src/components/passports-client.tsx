"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Filter, Fingerprint, X } from "lucide-react";
import { Frame, IconTile, Pill, Quiet, UI } from "@/components/intelligence/research-ui";
import {
  PASSPORT_EVIDENCE_FACETS,
  PASSPORT_ORIGIN_FACETS,
  PASSPORT_SAMPLING_WORDS,
  filterPassports,
  hasActivePassportFilters,
  offeredPassportFacets,
  type PassportEvidenceId,
  type PassportOriginId,
  type PassportRow,
} from "@/lib/passport-filter";

// Twelve at a time — six rows of the two-column card grid. These are cards, not table rows: a
// reader scans a handful, opens the one that concerns their batch, and comes back. Rendering all
// of them at once made the page a wall with no way to answer the only question a buyer actually
// arrives with, which is "is MY batch code on here".
const PAGE = 12;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function PassportsClient({ passports, total, verifyHref = "/verify", initialQuery = "", initialOrigins = [], initialEvidence = [] }: {
  passports: PassportRow[];
  /**
   * How many published passports EXIST. `passports` is capped by the server query, so its length is
   * a page size — and this page makes factual claims about the evidence corpus ("no batch on record
   * matches that"), which may only rest on the real count. Null when the count could not be read.
   */
  total: number | null;
  /** Where "check it directly" goes: the original verify page, or the research verifier when the original is closed. */
  verifyHref?: string;
  initialQuery?: string;
  initialOrigins?: PassportOriginId[];
  initialEvidence?: PassportEvidenceId[];
}) {
  const [query, setQuery] = useState(initialQuery);
  const [origins, setOrigins] = useState<PassportOriginId[]>(initialOrigins);
  const [evidence, setEvidence] = useState<PassportEvidenceId[]>(initialEvidence);
  const [visible, setVisible] = useState(PAGE);

  // The server caps the query, so anything it did not send is invisible to every filter on this
  // page. Saying so is the difference between "we hold no such batch" and "we did not load it".
  const truncated = total !== null && total > passports.length;

  const filters = useMemo(() => ({ query, origins, evidence }), [query, origins, evidence]);
  const results = useMemo(() => filterPassports(passports, filters), [passports, filters]);

  // Counts are taken over the WHOLE set, not the current results, so a chip's number always reads
  // as "how many records this would show me", never as a figure that shifts under the pointer.
  const originOptions = useMemo(() => offeredPassportFacets(PASSPORT_ORIGIN_FACETS, passports), [passports]);
  const evidenceOptions = useMemo(() => offeredPassportFacets(PASSPORT_EVIDENCE_FACETS, passports), [passports]);

  // Keep the URL in step so a filtered view can be linked or reloaded. replaceState rather than a
  // router push: the filtering is entirely client-side, and pushing per keystroke would bury the
  // back button under one entry per character.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    for (const origin of origins) params.append("origin", origin);
    for (const id of evidence) params.append("evidence", id);
    const search = params.toString();
    window.history.replaceState(null, "", search ? `${window.location.pathname}?${search}` : window.location.pathname);
  }, [query, origins, evidence]);

  // Every filter change re-pages from the top. Done in the mutators rather than an effect so the
  // reset lands in the same render as the filter change — leaving `visible` where it was would
  // silently show a reader the 40th match of a fresh search.
  function applyQuery(next: string) { setQuery(next); setVisible(PAGE); }
  function applyOrigin(id: PassportOriginId) { setOrigins((current) => toggle(current, id)); setVisible(PAGE); }
  function applyEvidence(id: PassportEvidenceId) { setEvidence((current) => toggle(current, id)); setVisible(PAGE); }

  const active = hasActivePassportFilters(filters);
  const shown = results.slice(0, visible);
  const remaining = results.length - shown.length;

  function reset() {
    setQuery("");
    setOrigins([]);
    setEvidence([]);
    setVisible(PAGE);
  }

  return (
    <>
      {/* The kit's Frame has no data-testid slot, so the filter card carries its classes directly. */}
      <section aria-label="Filter batch test records" data-testid="passport-filters" className="ink hard rounded-[18px] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => applyQuery(event.target.value)}
            placeholder="Search a batch code, compound, or vendor"
            aria-label="Search batch test records"
            className={UI.field + " min-w-0 flex-1"}
          />
          {query && <Pill variant="ghost" size="sm" icon={X} ariaLabel="Clear search" onClick={() => applyQuery("")} className="shrink-0">Clear</Pill>}
        </div>
        <p className={UI.small + " mt-2"}>
          Batch codes match with or without their dashes &mdash; type it the way it is printed on the vial.
        </p>

        <div className="mt-5 space-y-4">
          <Facets label="Evidence" hint="Derived from what is on the record — the count of tests, and whether any of them still disagree">
            {evidenceOptions.map((option) => (
              <Chip key={option.id} on={evidence.includes(option.id)} title={option.note} onClick={() => applyEvidence(option.id)}>
                {option.label} <span className="tabular-nums opacity-60">{option.count}</span>
              </Chip>
            ))}
          </Facets>

          <Facets label="Record type" hint="Live records aggregate real public lab certificates. Demo records are seeded samples that illustrate the interface.">
            {originOptions.map((option) => (
              <Chip key={option.id} on={origins.includes(option.id)} title={option.note} onClick={() => applyOrigin(option.id)}>
                {option.label} <span className="tabular-nums opacity-60">{option.count}</span>
              </Chip>
            ))}
          </Facets>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#111214] pt-4">
          <p className="text-sm font-bold tabular-nums text-[#111214]" data-testid="passport-count">
            {results.length} batch{results.length === 1 ? "" : "es"}
            {active && <span className="font-medium text-[var(--muted)]"> of {passports.length}</span>}
            {truncated && <span className="font-medium text-[var(--muted)]"> · newest {passports.length} of {total} loaded</span>}
          </p>
          {active && <Pill variant="ghost" size="sm" icon={Filter} onClick={reset}>Clear filters</Pill>}
        </div>
      </section>

      {results.length === 0 ? (
        <Frame pad="lg" className="mt-6 py-16 text-center">
          <p className={UI.h3}>No batch on record matches that.</p>
          <p className={UI.body + " mx-auto mt-2 max-w-md"}>
            A batch only appears here once a lab test for it is on the record, so this list is
            deliberately narrower than any vendor&rsquo;s catalogue.{" "}
            {truncated
              ? <>This page holds the newest {passports.length} of {total} records, so a missing code may
                simply be older than those &mdash; check it directly on <Link href={verifyHref} className="font-bold text-[#2b31d8] underline underline-offset-2">Verify</Link>.</>
              : <>A code that is missing has not been tested by anyone we hold results from &mdash; it does not
                mean the batch failed.</>}
          </p>
          <div className="mt-6"><Pill variant="ink" onClick={reset}>Clear filters</Pill></div>
        </Frame>
      ) : (
        <>
          <ul className="mt-6 grid gap-5 lg:grid-cols-2">
            {shown.map((p) => {
              const links = Number(p.evidence_links ?? 0);
              const conflicts = Number(p.open_conflicts ?? 0);
              return (
                <li key={p.id}>
                  <Link href={`/passports/${p.slug}`} className="ink hard press group flex h-full flex-col rounded-[18px] bg-white p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#2b31d8]">
                          {p.origin === "live" ? "Independent lab reports" : PASSPORT_SAMPLING_WORDS[String(p.sampling_level ?? "")] ?? "Tested batch"}
                        </p>
                        <h2 className={UI.h3 + " mt-2"}>Batch {p.declared_batch_code}</h2>
                        <p className={UI.body + " mt-2"}>
                          {p.vendor_name || "Vendor not linked"} &middot; {p.product_name || p.compound_name || "Compound not linked"}
                        </p>
                      </div>
                      <IconTile icon={Fingerprint} />
                    </div>
                    {/* mt-auto so every card in a row ends on the same line: the evidence summary
                        and the call to action sit on the floor of the card, not wherever the
                        vendor/product line happened to wrap to. */}
                    <div className="mt-auto pt-6">
                      <Quiet>
                        <p className="text-sm font-bold text-[#111214]">
                          {links} lab test{links === 1 ? "" : "s"}
                          {conflicts > 0 ? <span className="text-[#9b6b22]">, {conflicts} disagree{conflicts === 1 ? "s" : ""}</span> : ", no disagreements"}
                        </p>
                      </Quiet>
                      <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#2b31d8]">
                        Open the record <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {remaining > 0 ? (
            <div className="mt-8 flex flex-col items-center gap-2">
              <Pill onClick={() => setVisible((current) => current + PAGE)}>
                Show {Math.min(PAGE, remaining)} more
              </Pill>
              <p className={UI.small + " tabular-nums"}>Showing {shown.length} of {results.length}</p>
            </div>
          ) : (
            results.length > PAGE && <p className={UI.small + " mt-8 text-center"}>{truncated
              ? <>That is the newest {passports.length} of {total} records we hold{active ? " under this filter" : ""}.</>
              : <>That is every batch we hold a test for{active ? " under this filter" : ""}.</>}</p>
          )}
        </>
      )}
    </>
  );
}

function Facets({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  if (Array.isArray(items) && items.length === 0) return null;
  return (
    <div>
      <p className={UI.eyebrowMuted} title={hint}>{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{items}</div>
    </div>
  );
}

// The pressed-pill pattern the market's explorer uses: thin ink ring, ink fill when pressed.
function Chip({ on, title, onClick, children }: { on: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return <Pill size="sm" variant={on ? "ink" : "ghost"} ariaPressed={on} title={title} onClick={onClick}>{children}</Pill>;
}
