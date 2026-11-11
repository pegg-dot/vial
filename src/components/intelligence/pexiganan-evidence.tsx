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
import { Chip, Frame, IconTile, Notice, Pill, UI, type Tone } from "@/components/intelligence/research-ui";

// Tone says what kind of fact a status is: recorded (mint), connected across sources (blue), unresolved (amber).
const STATUS: Record<EvidenceAssessment, { text: string; tone: Tone; icon: typeof CheckCircle2 }> = {
  "directly-recorded": { text: "Original source field", tone: "mint", icon: CheckCircle2 },
  "cross-source-checked": { text: "Two-source relationship", tone: "blue", icon: BookOpenCheck },
  "needs-interpretation": { text: "Requires manual reconciliation", tone: "warn", icon: CircleAlert },
};

export function PexEvidenceScopeStrip() {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip tone="mint">2 distinct molecule identities</Chip>
      <Chip>4 curated NCT records</Chip>
      <Chip>4 selected PubMed records</Chip>
      <Chip>2 recorded lead sponsor names</Chip>
    </div>
  );
}

const WAYFINDER = [
  {
    icon: BookOpenCheck, title: "Evidence passport", sub: "Six claim-to-source checks, including the gaps",
    href: "#passport-claims", label: "Read the six checks",
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
] as const;

/** The dossier's "where next" frame: one cell per destination, the same four every time. */
export function PexEvidenceWayfinder({ condensed = false }: { condensed?: boolean }) {
  return (
    <section aria-label="Pexiganan evidence connections" className="ink hard-sm overflow-hidden rounded-[16px] bg-white">
      <div className="border-b-2 border-[#111214] bg-[#e6fbf6] px-5 py-5 sm:px-6">
        <p className={UI.eyebrow + " flex items-center gap-2"}><FileBadge className="size-4" aria-hidden="true" /> Evidence network · Source-first</p>
        <h2 className={UI.h2 + " mt-3"}>Where can you go from this record?</h2>
        <p className={UI.body + " mt-3 max-w-3xl"}>
          Choose the next question you want answered. You can read the source checks, look up an exact citation,
          inspect selected registered studies or find the organizations named on those records.
        </p>
      </div>
      <div className={"grid gap-px bg-[#111214]/15 sm:grid-cols-2 " + (condensed ? "" : "xl:grid-cols-4")}>
        {WAYFINDER.map(({ icon, title, sub, href, label }) => (
          <div key={title} className="bg-white p-4 sm:p-5">
            <IconTile icon={icon} tone="mint" size="sm" />
            <h3 className={UI.h4 + " mt-3"}>{title}</h3>
            <p className={UI.small + " mt-1"}>{sub}</p>
            <Link href={href} className={UI.linkSmall + " mt-3"}>{label} <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The six claim cards. `headless` drops the grid's own heading when a numbered section already supplies one. */
export function PexEvidenceClaimGrid({ headless = false }: { headless?: boolean }) {
  const claims = PEXIGANAN_CLAIMS;
  return (
    <section aria-label="Pexiganan claim and evidence checks">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {!headless && (
          <div>
            <p className={UI.eyebrowMuted}>The evidence, explained</p>
            <h3 className={UI.h3 + " mt-1"}>What these original sources actually support</h3>
          </div>
        )}
      </div>
      <div className={"grid gap-4 lg:grid-cols-2 " + (headless ? "" : "mt-4")}>
        {claims.map((claim, i) => {
          const badge = STATUS[claim.status];
          return (
            <Frame as="article" key={claim.id} id={"evidence-claim-" + claim.id} thin shadow="none" radius="rounded-[14px]" pad="sm" className="flex min-w-0 flex-col scroll-mt-36">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={UI.eyebrowMuted}>Observation {i + 1} of {claims.length}</span>
                <Chip tone={badge.tone} icon={badge.icon}>{badge.text}</Chip>
              </div>
              <h4 className={UI.h4 + " mt-3 leading-6"}>{claim.heading}</h4>
              <p className={UI.bodyInk + " mt-2"}>{claim.finding}</p>
              <Notice tone="warn" title="What this does not prove" className="mt-4">
                <p className="text-xs leading-5">{claim.whatItDoesNotShow}</p>
              </Notice>
              <div className="mt-4">
                <p className={UI.eyebrowMuted}>Traceable sources</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {claim.sourceIds.map(id => {
                    const source = pexSourceById(id);
                    if (!source) return null;
                    return <Pill key={id} href={source.url} external variant="ghost" size="sm" arrow="up">{source.identifier}</Pill>;
                  })}
                </div>
              </div>
              <p className={UI.small + " mt-4 border-t border-[#111214]/15 pt-3"}><span className="font-extrabold text-[#2b31d8]">Follow-up · </span>{claim.reviewTask}</p>
            </Frame>
          );
        })}
      </div>
    </section>
  );
}

const REGISTRY_RESULTS: Record<"present" | "not-shown" | "uncertain", { text: string; tone: Tone }> = {
  present: { text: "Results posted", tone: "mint" },
  "not-shown": { text: "No results section in record", tone: "paper" },
  uncertain: { text: "Results status unclear", tone: "warn" },
};

/** The four pinned registry rows, re-read live. Sits inside a numbered section on the passport and the dossier. */
export function PexTrialNetworkTable({ rows, headless = false }: { rows: readonly PexTrialEvidence[]; headless?: boolean }) {
  return (
    <section id="pexiganan-trials" aria-label="Pexiganan selected original trial records" className="scroll-mt-36 overflow-hidden rounded-[14px] border border-[#111214]/15 bg-white">
      <div className="border-b border-[#111214]/15 bg-[#e6fbf6] px-5 py-4">
        {!headless && <p className={UI.eyebrow}>The registry, checked live</p>}
        {!headless && <h3 className={UI.h3 + " mt-1"}>Four selected registered studies</h3>}
        <p className={UI.small + (headless ? " max-w-3xl" : " mt-2 max-w-3xl")}>
          Individually pinned NCTs, not a complete study review. Each row is checked for the name in its
          intervention field. A registry results section is different from a publication and from a conclusion about effectiveness.
        </p>
      </div>
      <div className="divide-y divide-[#111214]/10">
        {rows.map(row => (
          <article key={row.selected.nctId} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_220px]">
            {row.state !== "matched" ? (
              <>
                <div className="min-w-0">
                  <p className="break-all text-xs font-extrabold text-[#111214]">{row.selected.nctId}</p>
                  <h4 className="mt-1 flex items-center gap-1.5 text-sm font-extrabold text-[#111214]">
                    <CircleAlert className="size-4 shrink-0 text-[#9b6b22]" aria-hidden="true" />
                    {row.state === "unavailable" ? "Official study unavailable during this check" : "Intervention identity could not be reconfirmed"}
                  </h4>
                  <p className={UI.small + " mt-2"}>This row is NOT counted as a verified live name match. No inference about absent trials or publications.</p>
                </div>
                <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className={UI.linkSmall + " self-start"}>
                  Open original registry <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    <Chip tone="mint" icon={CheckCircle2}>Intervention field checked</Chip>
                    <Chip>{row.selected.nctId}</Chip>
                    <Chip tone={REGISTRY_RESULTS[row.registryResults].tone}>{REGISTRY_RESULTS[row.registryResults].text}</Chip>
                  </div>
                  <h4 className={UI.h4 + " mt-3 break-words leading-6"}>{row.title}</h4>
                  <p className={UI.small + " mt-2"}>Named intervention: <span className="font-bold text-[#111214]">{row.matchedIntervention}</span></p>
                  <p className={UI.small + " mt-1"}>Recorded sponsor: <span className="font-bold text-[#111214]">{row.sponsor ?? "Not reported"}</span></p>
                  <p className={UI.small + " mt-1"}>Registered primary measure: {row.primaryOutcomes[0] ?? "Not parsed"}</p>
                  {row.citations.length > 0 && (
                    <p className="mt-2 break-words text-[11px] font-medium leading-5 text-[#4a4d56]">
                      Registry references: {row.citations.map(citation => "PMID " + citation.pmid + " (" + citation.role + ", exact PubMed-NCT link " + citation.exactNctAssociation + ")").join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-start gap-2 lg:items-end lg:text-right">
                  <p className="text-xs font-bold text-[#4a4d56]">{row.phase?.replaceAll("PHASE", "Phase ") ?? "Phase not stated"} · {row.status?.replaceAll("_", " ").toLowerCase() ?? "Status unavailable"}</p>
                  <p className={UI.small}>Registry updated {row.lastRegistryUpdate ?? "unknown"}</p>
                  <Pill href={"/intelligence/studies/" + row.selected.nctId} variant="ink" size="sm" arrow="right">Verify this NCT</Pill>
                  <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className={UI.linkSmall}>Official source <ArrowUpRight className="size-3.5" aria-hidden="true" /></a>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
      <p className="border-t border-[#111214]/15 bg-[#fbfbf8] px-5 py-3 text-[11px] font-medium leading-5 text-[var(--muted)]">
        NIH metadata is cached for up to six hours. Status, sponsor, results and bibliographic roles are reported SOURCE FIELDS, not an assessment of clinical benefit or company ownership today.
      </p>
    </section>
  );
}

/** Every record behind the passport, closed by default; each row links to the verifier. */
export function PexSourceRegister() {
  return (
    <section aria-label="Original evidence source register" className="overflow-hidden rounded-[14px] border border-[#111214]/15 bg-white">
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-extrabold text-[#111214] hover:bg-[#eef0ff] [&::-webkit-details-marker]:hidden">
          <span>Open the complete original-source register ({PEXIGANAN_SOURCES.length} records)</span>
          <ArrowRight className="size-4 shrink-0 text-[#2b31d8] transition-transform group-open:rotate-90" aria-hidden="true" />
        </summary>
        <ul className="divide-y divide-[#111214]/10 border-t border-[#111214]/15">
          {PEXIGANAN_SOURCES.map(source => (
            <li key={source.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row">
              <div className="min-w-0 max-w-2xl">
                <p className={UI.eyebrowMuted}>{source.publisher} · {source.kind.replaceAll("-", " ")}</p>
                <h3 className="mt-1 break-words text-sm font-extrabold text-[#111214]">{source.identifier} · {source.label}</h3>
                <p className={UI.small + " mt-1"}>{source.observation}</p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#9b6b22]">{source.limitation}</p>
              </div>
              <Link href={"/intelligence/verify?ref=" + encodeURIComponent(source.identifier)} className={UI.linkSmall + " shrink-0 self-start"}>
                Check source <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </details>
      <p className="border-t border-[#111214]/15 px-5 py-3 text-[11px] font-medium leading-5 text-[var(--muted)]">
        Editorial source-check snapshot {PEXIGANAN_REVIEW_DATE}. Source URLs are provided for inspection; no journal full text or historic market vendor data is reproduced.
      </p>
    </section>
  );
}

/** Shared by the passport, the dossier and the organizations page: the one limit every pexiganan page states. */
export function PexNoLabVerification() {
  return (
    <Notice tone="warn" icon={ShieldAlert}>
      <h3 className="font-extrabold">No research-material testing verified here</h3>
      <p className="mt-1 text-xs leading-5">
        These official molecular, publication and trial records do not authenticate any commercial vial,
        supplier, certificate of analysis, sample custody chain or testing laboratory. The older marketplace
        lab and vendor grades are deliberately excluded. Missing evidence must not become a positive quality grade.
      </p>
    </Notice>
  );
}
