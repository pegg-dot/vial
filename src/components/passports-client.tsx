"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Filter, Fingerprint, ScanLine, Search, X } from "lucide-react";
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

export function PassportsClient({ passports, initialQuery = "", initialOrigins = [], initialEvidence = [] }: {
  passports: PassportRow[];
  initialQuery?: string;
  initialOrigins?: PassportOriginId[];
  initialEvidence?: PassportEvidenceId[];
}) {
  const [query, setQuery] = useState(initialQuery);
  const [origins, setOrigins] = useState<PassportOriginId[]>(initialOrigins);
  const [evidence, setEvidence] = useState<PassportEvidenceId[]>(initialEvidence);
  const [visible, setVisible] = useState(PAGE);

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
      <section aria-label="Filter batch test records" data-testid="passport-filters" className="ink hard rounded-[20px] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-[#111214] bg-[var(--background)] px-4 py-3 focus-within:shadow-[3px_3px_0_#6d5dfc]">
          <Search className="size-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => applyQuery(event.target.value)}
            placeholder="Search a batch code, compound, or vendor"
            aria-label="Search batch test records"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-[var(--muted)]"
          />
          {query && (
            <button onClick={() => applyQuery("")} aria-label="Clear search" className="ink-1 rounded-full bg-white p-1.5 text-[var(--muted)] transition hover:text-[#111214]">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] font-medium text-[var(--muted)]">
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
          <p className="text-sm font-bold tabular-nums" data-testid="passport-count">
            {results.length} batch{results.length === 1 ? "" : "es"}
            {active && <span className="font-medium text-[var(--muted)]"> of {passports.length}</span>}
          </p>
          {active && (
            <button onClick={reset} className="ink-1 press inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold">
              <Filter className="size-3" /> Clear filters
            </button>
          )}
        </div>
      </section>

      {results.length === 0 ? (
        <div className="ink hard mt-6 rounded-[20px] bg-white px-6 py-16 text-center">
          <p className="text-lg font-extrabold">No batch on record matches that.</p>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[var(--muted)]">
            A batch only appears here once a lab test for it is on the record, so this list is
            deliberately narrower than any vendor&rsquo;s catalogue. A code that is missing has not been
            tested by anyone we hold results from &mdash; it does not mean the batch failed.
          </p>
          <button onClick={reset} className="ink hard-sm press mt-6 rounded-full bg-[#111214] px-5 py-2.5 text-sm font-bold text-white">Clear filters</button>
        </div>
      ) : (
        <>
          <ul className="mt-6 grid gap-5 lg:grid-cols-2">
            {shown.map((p) => {
              const links = Number(p.evidence_links ?? 0);
              const conflicts = Number(p.open_conflicts ?? 0);
              return (
                <li key={p.id}>
                  <Link href={`/passports/${p.slug}`} className="group ink-1 hard press flex h-full flex-col rounded-[18px] bg-white p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#6d5dfc]">
                          {p.origin === "live" ? "Independent lab reports" : PASSPORT_SAMPLING_WORDS[String(p.sampling_level ?? "")] ?? "Tested batch"}
                        </p>
                        <h2 className="mt-2 text-2xl font-extrabold">Batch {p.declared_batch_code}</h2>
                        <p className="mt-2 text-sm font-medium text-[var(--muted)]">
                          {p.vendor_name || "Vendor not linked"} &middot; {p.product_name || p.compound_name || "Compound not linked"}
                        </p>
                      </div>
                      <span className="ink-1 grid size-12 shrink-0 place-items-center rounded-2xl bg-[#f0edff]"><Fingerprint className="size-5 text-[#6d5dfc]" /></span>
                    </div>
                    {/* mt-auto so every card in a row ends on the same line: the evidence summary
                        and the call to action sit on the floor of the card, not wherever the
                        vendor/product line happened to wrap to. */}
                    <div className="mt-auto pt-6">
                      <p className="ink-1 rounded-[14px] bg-[#f7f7f4] p-4 text-sm font-bold">
                        {links} lab test{links === 1 ? "" : "s"}
                        {conflicts > 0 ? <span className="text-[#b26a00]">, {conflicts} disagree{conflicts === 1 ? "s" : ""}</span> : ", no disagreements"}
                      </p>
                      <div className="mt-6 flex items-center gap-2 text-sm font-bold">Open the record <ScanLine className="size-4 transition group-hover:translate-x-1" /></div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {remaining > 0 ? (
            <div className="mt-8 flex flex-col items-center gap-2">
              <button
                onClick={() => setVisible((current) => current + PAGE)}
                className="ink hard press rounded-full bg-white px-6 py-3 text-sm font-bold"
              >
                Show {Math.min(PAGE, remaining)} more
              </button>
              <p className="text-xs font-medium tabular-nums text-[var(--muted)]">Showing {shown.length} of {results.length}</p>
            </div>
          ) : (
            results.length > PAGE && <p className="mt-8 text-center text-xs font-medium text-[var(--muted)]">That is every batch we hold a test for{active ? " under this filter" : ""}.</p>
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
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]" title={hint}>{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{items}</div>
    </div>
  );
}

function Chip({ on, title, onClick, children }: { on: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`ink-1 press inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${on ? "bg-[#111214] text-white" : "bg-white text-[#111214]"}`}
    >
      {children}
    </button>
  );
}
