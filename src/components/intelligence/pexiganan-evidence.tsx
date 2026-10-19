import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BookOpenCheck, Building2, CheckCircle2,
  CircleAlert, FileBadge, FlaskConical,
  ScanSearch, ShieldAlert,
} from "lucide-react";
import {
  PEXIGANAN_CLAIMS, PEXIGANAN_REVIEW_DATE, PEXIGANAN_SOURCES,
  pexSourceById, type EvidenceAssessment,
} from "@/lib/pexiganan-evidence-network";
import type { PexTrialEvidence } from "@/server/intelligence/pexiganan-network";

const STATUS: Record<EvidenceAssessment, { text: string; color: string; icon: typeof CheckCircle2 }> = {
  "directly-recorded": {
    text: "Original source field",
    color: "border-[#c2e7d0] bg-[#eaf9f0] text-[#246b54]",
    icon: CheckCircle2,
  },
  "cross-source-checked": {
    text: "Two-source relationship",
    color: "border-[#d4d9fb] bg-[#f0efff] text-[#5b4da0]",
    icon: BookOpenCheck,
  },
  "needs-interpretation": {
    text: "Requires manual reconciliation",
    color: "border-[#ecd7b8] bg-[#fff5e9] text-[#956226]",
    icon: CircleAlert,
  },
};

export function PexEvidenceScopeStrip() {
  return (
    <div className="flex flex-wrap gap-2 text-[10px] font-extrabold uppercase tracking-[.07em] text-[#405c53]">
      <span className="rounded-full border border-[#bee5d1] bg-[#eafff1] px-3 py-2">2 distinct molecule identities</span>
      <span className="rounded-full border border-[#d8dfed] bg-white px-3 py-2">4 curated NCT records</span>
      <span className="rounded-full border border-[#d8dfed] bg-white px-3 py-2">4 selected PubMed records</span>
      <span className="rounded-full border border-[#d8dfed] bg-white px-3 py-2">2 recorded lead sponsor names</span>
    </div>
  );
}

export function PexEvidenceWayfinder({ condensed = false }: { condensed?: boolean }) {
  return (
    <section aria-label="Pexiganan evidence connections" className="overflow-hidden rounded-[22px] border-2 border-[#17191b] bg-white">
      <div className="bg-[#dffff1] px-5 py-6 sm:px-7">
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.13em] text-[#1b806c]">
          <FileBadge className="size-4" /> Evidence network · Source-first
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-[-.05em] text-[#17191b] sm:text-3xl">
          Follow a compound, not a product listing.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[#4f6860]">
          Pexiganan is the starting point. Open its distinct molecular record, a specific original experiment,
          a registered study or the organizations named in those records. Every connection has an original source.
        </p>
        <div className="mt-4"><PexEvidenceScopeStrip /></div>
      </div>
      <div className={"grid grid-cols-2 gap-0 " + (condensed ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4")}>
        {([
          {
            icon: BookOpenCheck, title: "Evidence passport", sub: "Six claim-to-source checks, including the gaps",
            href: "/intelligence/passports/pexiganan", label: "Read passport",
          },
          {
            icon: ScanSearch, title: "Verify a record", sub: "Check a specific NCT, PMID or PubChem CID",
            href: "/intelligence/verify?ref=PMID%2036781451", label: "Try verification",
          },
          {
            icon: FlaskConical, title: "Registered studies", sub: "Four selected official intervention-name matches",
            href: "#pexiganan-trials", label: "Inspect trials",
          },
          {
            icon: Building2, title: "Organizations", sub: "Registered sponsors, not retailers or sellers",
            href: "/intelligence/organizations", label: "View source organizations",
          },
        ] as const).map(({ icon: Icon, title, sub, href, label }, i) => (
          <div key={title} className={"border-t border-[#dfe5e3] p-3.5 sm:p-5 " + (i % 2 === 1 ? "border-l border-[#dfe5e3]" : i > 1 ? "xl:border-l xl:border-[#dfe5e3]" : "")}>
            <div className="grid size-10 place-items-center rounded-xl bg-[#f0f3f2]"><Icon className="size-5 text-[#236e63]" /></div>
            <h3 className="mt-3 text-sm font-extrabold tracking-[-.025em] text-[#202728] sm:text-base">{title}</h3>
            <p className="mt-1 min-h-[42px] text-xs leading-5 text-[#64716e]">{sub}</p>
            <Link href={href} className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-xs font-extrabold text-[#1e7261] hover:underline">
              {label} <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PexEvidenceClaimGrid({ compact = false }: { compact?: boolean }) {
  const claims = compact ? PEXIGANAN_CLAIMS.slice(0, 3) : PEXIGANAN_CLAIMS;
  return (
    <section aria-label="Pexiganan claim and evidence checks">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#188673]">The evidence, explained</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-[-.05em]">What these original sources actually support</h2>
        </div>
        {compact && <Link href="/intelligence/passports/pexiganan" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#267568] hover:underline">All six checks <ArrowRight className="size-4" /></Link>}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {claims.map((claim, i) => {
          const badge = STATUS[claim.status];
          const Icon = badge.icon;
          return (
            <article key={claim.id} id={"evidence-claim-" + claim.id}
              className="min-w-0 scroll-mt-36 rounded-2xl border border-[#dce5e0] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#83918a]">Observation {i + 1} / {claims.length}</span>
                <span className={"inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-bold " + badge.color}>
                  <Icon className="size-3.5" /> {badge.text}
                </span>
              </div>
              <h3 className="mt-3 text-base font-extrabold leading-6 tracking-[-.025em] text-[#242d2b]">{claim.heading}</h3>
              <p className="mt-2 text-sm leading-6 text-[#4f625b]">{claim.finding}</p>
              <div className="mt-4 border-l-[3px] border-[#ddb879] bg-[#fffaf1] px-3 py-2.5">
                <p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[#a07c3e]">What this does not prove</p>
                <p className="mt-1 text-xs leading-5 text-[#735c44]">{claim.whatItDoesNotShow}</p>
              </div>
              <div className="mt-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[#73817c]">Traceable sources</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {claim.sourceIds.map(id => {
                    const source = pexSourceById(id);
                    if (!source) return null;
                    return <a key={id} href={source.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-[#d7dfdb] px-2.5 py-2 text-[11px] font-bold text-[#315f56] hover:border-[#277765] hover:bg-[#ecf8f2]">
                      {source.identifier} <ArrowUpRight className="size-3" />
                    </a>;
                  })}
                </div>
              </div>
              {!compact && <p className="mt-4 border-t border-[#e8eae8] pt-3 text-xs leading-5 text-[#64746e]"><span className="font-bold text-[#354b42]">Follow-up:</span> {claim.reviewTask}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

const REGISTRY_RESULTS: Record<"present" | "not-shown" | "uncertain", string> = {
  present: "Results posted",
  "not-shown": "No results section in record",
  uncertain: "Results status unclear",
};

export function PexTrialNetworkTable({ rows }: { rows: readonly PexTrialEvidence[] }) {
  return (
    <section id="pexiganan-trials" aria-label="Pexiganan selected original trial records" className="scroll-mt-36 overflow-hidden rounded-2xl border-2 border-[#17191b] bg-white">
      <div className="border-b border-[#dfe7e1] bg-[#f1fbf5] px-5 py-5 sm:px-6">
        <p className="text-[11px] font-black uppercase tracking-[.12em] text-[#1a806f]">The registry, checked live</p>
        <h2 className="mt-1 text-xl font-extrabold tracking-[-.04em]">Four selected registered studies</h2>
        <p className="mt-2 max-w-3xl text-xs leading-6 text-[#63736c]">
          Individually pinned NCTs, not a complete study review. Each row is checked for the name in its
          intervention field. A registry results section is different from a publication and from a conclusion about effectiveness.
        </p>
      </div>
      <div className="divide-y divide-[#e7ebe9]">
        {rows.map(row => (
          <article key={row.selected.nctId} className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_200px]">
            {row.state !== "matched" ? (
              <>
                <div>
                  <p className="text-xs font-extrabold text-[#4b4955]">{row.selected.nctId}</p>
                  <h3 className="mt-1 text-sm font-bold text-[#a06a35]">
                    {row.state === "unavailable" ? "Official study unavailable during this check" : "Intervention identity could not be reconfirmed"}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[#7c7771]">This row is NOT counted as a verified live name match. No inference about absent trials or publications.</p>
                </div>
                <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-fit items-center gap-1 text-xs font-bold text-[#275f57] hover:underline">
                  Open original registry <ArrowUpRight className="size-3.5" />
                </a>
              </>
            ) : (
              <>
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-md bg-[#e8f8ed] px-2.5 py-1 text-[10px] font-extrabold text-[#286e55]">Intervention field checked</span>
                    <span className="rounded-md bg-[#f1f2f2] px-2.5 py-1 text-[10px] font-bold text-[#566761]">{row.selected.nctId}</span>
                    <span className="rounded-md bg-[#f6f2e9] px-2.5 py-1 text-[10px] font-bold text-[#866c43]">{REGISTRY_RESULTS[row.registryResults]}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-extrabold leading-6 text-[#26322d]">{row.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-[#6c7772]">Named intervention: <span className="font-semibold text-[#48574f]">{row.matchedIntervention}</span></p>
                  <p className="mt-1 text-xs leading-5 text-[#6c7772]">Recorded sponsor: <span className="font-semibold text-[#48574f]">{row.sponsor ?? "Not reported"}</span></p>
                  <p className="mt-1 text-xs leading-5 text-[#6c7772]">Registered primary measure: {row.primaryOutcomes[0] ?? "Not parsed"}</p>
                  {row.citations.length > 0 && (
                    <p className="mt-2 text-[11px] leading-5 text-[#656e6c]">
                      Registry references: {row.citations.map(citation => "PMID " + citation.pmid + " (" + citation.role + ", exact PubMed-NCT link " + citation.exactNctAssociation + ")").join(" · ")}
                    </p>
                  )}
                </div>
                <div className="space-y-2 lg:text-right">
                  <p className="text-xs font-semibold text-[#68716c]">{row.phase?.replaceAll("PHASE", "Phase ") ?? "Phase not stated"} · {row.status?.replaceAll("_", " ").toLowerCase() ?? "Status unavailable"}</p>
                  <p className="text-[11px] text-[#8b938f]">Registry updated {row.lastRegistryUpdate ?? "unknown"}</p>
                  <Link href={"/intelligence/studies/" + row.selected.nctId}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#17191b] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#34574d]">
                    Verify this NCT <ArrowRight className="size-3.5" />
                  </Link>
                  <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#256f60] hover:underline">Official source <ArrowUpRight className="size-3" /></a>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
      <div className="border-t border-[#e5e9e6] bg-[#fafcfb] px-5 py-4 text-[11px] leading-5 text-[#7f8983]">
        NIH metadata is cached for up to six hours. Status, sponsor, results and bibliographic roles are reported SOURCE FIELDS, not an assessment of clinical benefit or company ownership today.
      </div>
    </section>
  );
}

export function PexSourceRegister() {
  return (
    <section aria-label="Original evidence source register" className="overflow-hidden rounded-2xl border border-[#dbe2df] bg-white">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-5 text-sm font-extrabold text-[#26342e] sm:px-6 [&::-webkit-details-marker]:hidden">
          <span>Open the complete original-source register ({PEXIGANAN_SOURCES.length} records)</span>
          <ArrowRight className="size-4 shrink-0 text-[#317767] transition-transform group-open:rotate-90" />
        </summary>
        <div className="divide-y divide-[#e7ebe7] border-t border-[#e7ebe7]">
          {PEXIGANAN_SOURCES.map(source => (
            <div key={source.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:px-6">
              <div className="max-w-2xl">
                <p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[#789081]">{source.publisher} · {source.kind.replaceAll("-", " ")}</p>
                <h3 className="mt-1 text-sm font-bold text-[#283a32]">{source.identifier} · {source.label}</h3>
                <p className="mt-1 text-xs leading-5 text-[#65746c]">{source.observation}</p>
                <p className="mt-1 text-xs leading-5 text-[#967751]">{source.limitation}</p>
              </div>
              <Link href={"/intelligence/verify?ref=" + encodeURIComponent(source.identifier)}
                className="inline-flex h-fit shrink-0 items-center gap-1.5 text-xs font-bold text-[#24765f] hover:underline">
                Check source <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </details>
      <div className="border-t border-[#e7ebe7] px-5 py-3 text-[11px] leading-5 text-[#7b887f] sm:px-6">
        Editorial source-check snapshot {PEXIGANAN_REVIEW_DATE}. Source URLs are provided for inspection; no journal full text or historic market vendor data is reproduced.
      </div>
    </section>
  );
}

export function PexNoLabVerification() {
  return (
    <div className="rounded-2xl border border-[#e8dac1] bg-[#fffbf2] p-5">
      <div className="flex items-center gap-2 text-[#95713b]"><ShieldAlert className="size-4" /><h3 className="text-sm font-extrabold">No research-material testing verified here</h3></div>
      <p className="mt-2 text-xs leading-6 text-[#7d705f]">
        These official molecular, publication and trial records do not authenticate any commercial vial,
        supplier, certificate of analysis, sample custody chain or testing laboratory. The older marketplace
        lab and vendor grades are deliberately excluded. Missing evidence must not become a positive quality grade.
      </p>
    </div>
  );
}
