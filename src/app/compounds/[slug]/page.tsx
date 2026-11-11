import type { Metadata } from "next";
import { Suspense } from "react";
import { ResearchScopeNotice } from "@/components/research-scope-notice";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/server/catalog/repository";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChartNoAxesCombined, CheckCircle2, CircleAlert, ClipboardCheck, FileSearch, GitCompareArrows, Layers3, Store } from "lucide-react";
import { getCompoundBySlug, getProductsByCompoundSlug } from "@/server/catalog/repository";
import { PURITY_PROVENANCE_SHORT } from "@/lib/provenance-copy";
import { formatCurrency } from "@/lib/format";
import { educationFor } from "@/lib/compound-education";
import { depthFor } from "@/lib/compound-depth";
import { GoalTags } from "@/components/goal-tags";
import { CompoundKnowledge } from "@/components/compound-knowledge";
import { UsLegalNotice } from "@/components/us-legal-notice";
import { PriceSeries } from "@/components/price-series";
import { evidenceOnlyPublicRelease, hidesCommerce, hidesMarket, publicBrowseRelease } from "@/lib/public-research-release";
import {
  compareExplorerHref, registryDiscoveryUrl, researchSubjectBySlug, researchThemeById, RESEARCH_SUBJECTS, verifiedPubmedSearchUrl,
} from "@/lib/research-explorer";
import { describeCompoundBasis, formatPct } from "@/lib/price-trend";
import { getCompoundDailyMedianSeries } from "@/server/ingest/price-history";
import { FollowButton } from "@/components/follow-button";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { LabTestsPanel } from "@/components/lab-tests-panel";
import { PassportCarousel, type PassportRow } from "@/components/passport-carousel";
import { listPublicPassportsForCompound } from "@/server/evidence-network/repository";
import { PriceLeaderboard } from "@/components/price-leaderboard";
import { getLabTestsForCompound } from "@/server/ingest/lab-tests";
import { getVendorDirectory } from "@/server/vendors/directory";
import { projectDirectoryEntry } from "@/lib/evidence-projection";
import { CompoundVendors, type CompoundVendorEntry } from "@/components/compound-vendors";
import { getDatabase } from "@/server/db/client";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { listFollows } from "@/server/consumer-intelligence/repository";
import { getCompoundResearch, getCompoundRegulatory } from "@/server/external/repository";
import { CompoundResearchPanel } from "@/components/compound-research-panel";
import { InnovatorNote } from "@/components/innovator-note";
import { JsonLd } from "@/components/json-ld";
import { HashLanding } from "@/components/hash-landing";
import { compoundSchema } from "@/lib/structured-data";
import { stacksContaining } from "@/lib/stacks";
import { DossierPerspective } from "@/components/intelligence/dossier-perspective";
import { ResearchFileGradeCard, ResearchFileGradeMark } from "@/components/intelligence/research-file-grade";
import { gradeResearchFile } from "@/lib/research-file-grade";
import { DossierTrialEvidence, TrialEvidenceLoading } from "@/components/intelligence/dossier-trial-evidence";
import { DossierOrganizations, OrganizationsLoading } from "@/components/intelligence/dossier-organizations";
import { PexEvidenceWayfinder, PexNoLabVerification, PexSourceRegister } from "@/components/intelligence/pexiganan-evidence";
import { PexEvidencePassport, PEX_REGISTER_NOTE, PEX_REGISTRY_NOTE } from "@/components/intelligence/pexiganan-passport";
import { PexigananResearchWorkspace } from "@/components/intelligence/pexiganan-research-workspace";
import { PexTrialNetworkLive, PexTrialNetworkLoading } from "@/components/intelligence/pexiganan-trial-network";
import { Chip, ContentsLayout, Frame, Notice, NumberedSection, PageHero, Pill, Quiet, Section, SectionHeading, Stat, UI, type ContentsItem } from "@/components/intelligence/research-ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [subject, compound] = [researchSubjectBySlug(slug), await getCompoundBySlug(slug)];
  if (!subject && !compound) return {};
  const name = compound?.name ?? subject!.name;
  return {
    title: `${name} ${subject ? "research file" : "evidence record"} | VialGrade`,
    description: subject
      ? `${name}: molecular identity, registered studies, original sources${compound ? ", independent lab tests and batch passports" : ""} on record.`
      : `Independent lab tests, batch passports, published research and regulatory context on record for ${name}.`,
    alternates: { canonical: `/compounds/${slug}` },
    ...(compound ? {} : { robots: { index: false, follow: false } }),
  };
}

// The public half of this page — listings, lab tests, literature, regulatory status, passports.
// Identical for every visitor, so it is loaded once and cached under the shared "catalog" tag that
// the collect cron invalidates on write. getCurrentPrincipal() stays outside: it reads a cookie,
// and caching anything derived from it would leak one visitor's session state to another.
const loadCompoundPublicData = unstable_cache(
  async (slug: string) => {
    const [listings, labTests, research, regulatory, allPassports, medianSeries, directory] = await Promise.all([getProductsByCompoundSlug(slug), getDatabase().then((db) => getLabTestsForCompound(db, slug)), getDatabase().then((db) => getCompoundResearch(slug, db)), getDatabase().then((db) => getCompoundRegulatory(slug, db)), listPublicPassportsForCompound(slug, 12), getDatabase().then((db) => getCompoundDailyMedianSeries(db, slug)), getVendorDirectory().catch(() => [])]);
    return { listings, labTests, research, regulatory, allPassports, medianSeries, directory };
  },
  ["compound-page"],
  { tags: [CATALOG_CACHE_TAG], revalidate: 21600 },
);

const EMPTY_PUBLIC: Awaited<ReturnType<typeof loadCompoundPublicData>> = { listings: [], labTests: [], research: [], regulatory: null, allPassports: [], medianSeries: [], directory: [] };

const quiet = "rounded-[14px] border border-[#111214]/15 bg-[#fbfbf8] p-5";

/**
 * One page per compound. A compound may have a curated research file (the 16 research subjects:
 * identity, registered studies, original sources), a catalog record (lab tests, batch passports,
 * published research, vendors tested), or both. The research sections come first in the file's
 * fixed order, the catalog sections after, limits last, all under one sticky contents list.
 * Under the evidence-only release with the browse release off, only the research sections render.
 */
export default async function CompoundPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const subject = researchSubjectBySlug(slug);
  const compound = await getCompoundBySlug(slug);
  if (!subject && !compound) notFound();
  const evidenceOnly = evidenceOnlyPublicRelease();
  const showCatalog = Boolean(compound) && (!evidenceOnly || publicBrowseRelease());
  if (!subject && !showCatalog) notFound();
  const name = compound?.name ?? subject!.name;

  const [publicData, principal] = await Promise.all([showCatalog ? loadCompoundPublicData(slug) : Promise.resolve(EMPTY_PUBLIC), getCurrentPrincipal()]);
  const { listings, labTests, research, regulatory, allPassports, medianSeries, directory } = publicData;
  const passports = allPassports as unknown as PassportRow[];
  // Under the evidence-only release this page is for looking into a compound: lab evidence, passports,
  // research. No prices, listings, market table or follow button.
  const noCommerce = hidesCommerce();
  // The market record (who lists it, the price as last read, the listing it was read from) is its
  // own release on top of browsing. Follow buttons and stack pages stay with noCommerce.
  const noMarket = hidesMarket();
  const showMarket = Boolean(compound) && showCatalog && listings.length > 0 && !noMarket;
  // Every directory vendor that lists this compound or whose independent evidence names it, in the
  // directory's order, with the letter from each one's own record. Under the evidence-only release
  // the entries are projected like the directory's, so no price reaches the page; the listings
  // themselves never leave the server (only which vendors they belong to).
  const countBy = (slugs: (string | null | undefined)[]) => { const m = new Map<string, number>(); for (const s of slugs) if (s) m.set(s, (m.get(s) ?? 0) + 1); return m; };
  const testsByVendor = countBy(labTests.map((t) => t.vendor_slug));
  const batchesByVendor = countBy(passports.map((p) => p.vendor_slug));
  const listingVendorSlugs = new Set(listings.map((l) => l.vendorSlug));
  const vendorEntries: CompoundVendorEntry[] = directory
    .filter((e) => listingVendorSlugs.has(e.vendor.slug) || testsByVendor.has(e.vendor.slug) || batchesByVendor.has(e.vendor.slug))
    .map((e) => ({ entry: noCommerce ? projectDirectoryEntry(e) : e, lists: listingVendorSlugs.has(e.vendor.slug), tests: testsByVendor.get(e.vendor.slug) ?? 0, batches: batchesByVendor.get(e.vendor.slug) ?? 0 }));
  const vendorsLabel = vendorEntries.length === 1 ? "See 1 vendor" : "See " + vendorEntries.length + " vendors";
  const edu = showCatalog ? educationFor(slug) : null;
  // "Commonly stacked with" = the bundles surface. Resolve each stacked slug to a real compound
  // (so we only ever link to compounds we actually track) and carry its cheapest listing price.
  const stacked = showCatalog && edu?.stackedWith?.length
    ? (await Promise.all(edu.stackedWith.map((s) => getCompoundBySlug(s)))).filter((c): c is NonNullable<typeof c> => Boolean(c))
    : [];
  const inStacks = showCatalog ? stacksContaining(slug) : [];
  const follows = principal && showCatalog ? await listFollows(principal.id) : [];
  const followed = follows.some((item) => item.entityType === "compound" && item.entitySlug === slug);

  // The research file: its theme, its source-coverage letter, its neighbours, and pexiganan's extras.
  const theme = subject ? researchThemeById(subject.theme) : null;
  const file = subject ? gradeResearchFile(subject) : null;
  const related = subject ? RESEARCH_SUBJECTS.filter((other) => other.theme === subject.theme && other.slug !== slug).slice(0, 3) : [];
  const isPex = subject?.slug === "pexiganan";

  // One contents list in a fixed order: the research file's sections, then the catalog's, limits last.
  // Only sections that render get a stop, and frames are numbered in the order they appear.
  const contents: ContentsItem[] = [
    ...(subject ? [
      { id: "overview", label: "Overview" },
      { id: "file-grade", label: "Source file" },
      { id: "studies", label: "Studies" },
      { id: "sources", label: "Sources" },
      { id: "material-evidence", label: "Materials" },
    ] : []),
    ...(edu ? [{ id: "understand", label: "Understand" }] : []),
    ...(vendorEntries.length ? [{ id: "vendors", label: "Vendors" }] : []),
    ...(showMarket ? [{ id: "market", label: evidenceOnly ? "Market record" : "The market" }] : []),
    ...(labTests.length || passports.length ? [{ id: "lab-tests", label: "Lab tests" }] : []),
    ...(showCatalog && (research.length || regulatory) ? [{ id: "research", label: "Research" }] : []),
    ...(stacked.length || inStacks.length ? [{ id: "stacked", label: "Stacked with" }] : []),
    ...(subject ? [{ id: "related", label: "Limits and related" }] : []),
  ];
  const sectionNumber = (id: string) => contents.findIndex((item) => item.id === id) + 1;

  // The hero chart is the DAILY in-stock median across listings, dated — not the old
  // position-by-position average of undated arrays, which averaged different listings' Nth checks
  // as if they were the same day. The pill is earned or absent (D6).
  const medianPoints = medianSeries.map((p) => ({ day: p.day, price: p.median, available: true }));
  const basisCopy = compound ? describeCompoundBasis(compound.priceChangeBasis) : "";
  const earned = compound?.priceChangeBasis?.medianPct != null;

  const evidenceCard = compound && (
    <Frame shadow="lg" radius="rounded-[22px]" pad="lg">
      <p className={UI.eyebrowMuted}>Independent lab evidence on record</p>
      <p className="mt-1.5 text-5xl font-extrabold tabular-nums tracking-[-.055em] text-[#111214]">{compound.coaCount}</p>
      <p className="mt-1 text-xs font-bold text-[var(--muted)]">
        {compound.coaCount === 1 ? "certificate" : "certificates"}{compound.medianPurity != null ? " · median reported purity " + compound.medianPurity.toFixed(1) + "%" : ""} · {passports.length} batch {passports.length === 1 ? "passport" : "passports"}
      </p>
      <p className="mt-4 text-[11px] font-medium leading-4 text-[var(--muted)]">{PURITY_PROVENANCE_SHORT} Purity is a lab&rsquo;s figure for one sample, not a grade of the compound or of any seller. <Link href="/grades" className="font-extrabold text-[#2b31d8] hover:underline">How grades work</Link></p>
    </Frame>
  );
  const priceCard = compound && (
    <Frame shadow="lg" radius="rounded-[22px]" pad="lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={UI.eyebrowMuted}>Observed median price</p>
          {/* A compound with no listings has no observed price: the stored 0.00 must never read as a
              market observation. */}
          <p className="mt-1.5 text-5xl font-extrabold tabular-nums tracking-[-.055em] text-[#111214]">
            {compound.medianPrice > 0 ? formatCurrency(compound.medianPrice) : "—"}
          </p>
          {compound.medianPrice > 0 ? null : (
            <p className="mt-1 text-xs font-bold text-[var(--muted)]">No listings on record, so there is no observed price.</p>
          )}
        </div>
        <span title={basisCopy}><Chip plain tone={earned ? "white" : "paper"} className="tabular-nums">{earned ? `${formatPct(compound.priceChangeBasis!.medianPct!)} · 30d` : "Δ —"}</Chip></span>
      </div>
      <div className="mt-5 h-28"><PriceSeries points={medianPoints} description={basisCopy} accent={compound.accent[0]} height={94} compact /></div>
      <p className="mt-3 text-[11px] font-medium leading-4 text-[var(--muted)]">{basisCopy}</p>
    </Frame>
  );
  // A research file with no catalog record states what the file is, in the same slot a catalog
  // record would show its evidence figures.
  const snapshotCard = subject && file && (
    <Frame shadow="lg" radius="rounded-[22px]" pad="lg" tone="mint">
      <dl className="grid gap-4">
        {[
          ["What is this?", "A curated identity file, not a material listing."],
          ["What is linked?", file.linkedCount + " of 3 research source types in this file."],
          ["What is not verified?", "Clinical benefit or any physical sample."],
        ].map(([term, text]) => (
          <div key={term}>
            <dt className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0b6b60]">{term}</dt>
            <dd className="mt-1 text-sm font-bold text-[#111214]">{text}</dd>
          </div>
        ))}
      </dl>
    </Frame>
  );
  // Under the evidence-only release the hero stays with the lab evidence even when the market
  // record is released: the prices sit in their own section further down, after the evidence.
  const aside = showCatalog ? (evidenceOnly ? evidenceCard : priceCard) : snapshotCard;
  // Each listing vendor's released website (or null), which is what a row's source citation needs.
  const websiteByVendor = new Map(directory.map((e) => [e.vendor.slug, e.websiteUrl]));

  const crumbs = [
    { href: "/intelligence", label: "Home" },
    { href: "/compounds", label: "Compounds" },
    { label: name },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      {/* Sections above the source trail stream in; a hash landing (the retired sponsor page, the
          passport) must still end up on its target. */}
      <HashLanding />
      {/* A reference entry in the compound directory. Deliberately DefinedTerm and not schema.org/Drug:
          asserting a medical entity for a grey-market research peptide would claim a standing no
          evidence on this page supports. */}
      {compound && <JsonLd data={compoundSchema({ slug, name: compound.name, description: compound.description, aliases: compound.aliases, category: compound.category })} />}

      <PageHero art={["molecule", "flask"]} breadcrumb={crumbs}
        eyebrow={<>
          {theme && <Chip tone="mint">{theme.name}</Chip>}
          {compound && <Chip tone="blue">{compound.category}</Chip>}
          {compound?.origin === "live" && <DataOriginBadge origin="live" />}
        </>}
        title={name}
        /* Plain words first: the research file's one-line identity when there is one, else the
           catalog's plain-English summary. */
        lead={subject?.identity ?? edu?.summary ?? compound?.description}
        note={subject ? "This letter describes linked source types in our file, not how promising or safe the compound is." : undefined}
        actions={subject || vendorEntries.length ? <>
          {subject && <>
            <Pill href={isPex ? "#research-workspace" : "#overview"} variant="primary" arrow="right">{isPex ? "Investigate the evidence" : "Start with the research question"}</Pill>
            <Pill href={subject.referenceUrl} external arrow="up">Inspect molecular identity</Pill>
            {related[0] && <Pill href={compareExplorerHref([subject.slug, related[0].slug], "researcher")} icon={GitCompareArrows}>Compare with {related[0].name}</Pill>}
          </>}
          {/* The way to the vendors is one click from the top: the section, then each vendor's record or site. */}
          {vendorEntries.length ? <Pill href="#vendors" variant={subject ? "ghost" : "primary"} icon={Store} arrow="right">{vendorsLabel}</Pill> : null}
        </> : undefined}
        aside={aside}
      >
        {subject && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {isPex && file && <Chip tone="mint" plain>{file.linkedCount} of 3 research source types on file</Chip>}
            <ResearchFileGradeMark subject={subject} withCount />
          </div>
        )}
        {edu?.goals?.length ? <div className="mt-5"><GoalTags goals={edu.goals} size="md" /></div> : null}
        {compound && showCatalog && (
          <div className="mt-5 flex flex-wrap gap-2">
            {compound.aliases.map((alias) => <Chip key={alias} plain>{alias}</Chip>)}
          </div>
        )}
        {compound && showCatalog && !noCommerce ? <div className="mt-6"><FollowButton entityType="compound" entitySlug={slug} entityName={compound.name} initialFollowed={followed} /></div> : null}
      </PageHero>

      <Section tight>
        {isPex && <div className="mb-4"><PexigananResearchWorkspace /></div>}

        <ContentsLayout contents={contents} label="On this page">
          {showCatalog && <ResearchScopeNotice bare />}

          {compound && showCatalog && (
            <div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {noMarket ? <Stat icon={Layers3} label="Batch passports" value={passports.length} /> : <Stat icon={Layers3} label={evidenceOnly ? "Listings on record" : "Active listings"} value={compound.listings} />}
                <Stat icon={FileSearch} label="Independent lab tests" value={compound.medianPurity != null ? `${compound.coaCount} · ${compound.medianPurity.toFixed(1)}%` : compound.coaCount} />
                {noMarket ? <Stat icon={ChartNoAxesCombined} label="Research findings on file" value={research.length} /> : <Stat icon={ChartNoAxesCombined} label="Observed price range" value={listings.length ? `${formatCurrency(Math.min(...listings.map((item) => item.price)))}–${formatCurrency(Math.max(...listings.map((item) => item.price)))}` : "No active listings"} />}
                <Stat icon={BookOpen} label="Known aliases" value={compound.aliases.length + 1} />
              </div>
              {compound.medianPurity != null && <p className="mt-3 text-[11px] font-medium leading-4 text-[var(--muted)]">{PURITY_PROVENANCE_SHORT} <Link href="/grades" className="font-extrabold text-[#2b31d8] hover:underline">Purity vs grade</Link></p>}
            </div>
          )}

          {/* ── The research file, in its fixed order ─────────────────────────────────────── */}
          {subject && theme && file && (
            <div className="grid items-start gap-4 xl:grid-cols-2">
              <NumberedSection id="overview" number={sectionNumber("overview")} eyebrow="Overview" title={subject.studyQuestion}
                intro={"Start by checking studies of " + subject.mechanism.toLowerCase() + ", rather than inferring clinical outcomes or experiment suitability from the molecule name."}>
                <DossierPerspective research={subject.scientistAngle} analyst={subject.analystAngle} />
                <dl className="grid gap-4 sm:grid-cols-3">
                  <div><dt className={UI.eyebrowMuted}>Research area</dt><dd className="mt-1 text-sm font-bold">{theme.short}</dd></div>
                  <div><dt className={UI.eyebrowMuted}>Mechanism</dt><dd className="mt-1 text-sm font-bold">{subject.mechanism}</dd></div>
                  <div><dt className={UI.eyebrowMuted}>Identity reference</dt><dd className="mt-1 text-sm font-bold">{subject.referenceLabel}</dd></div>
                </dl>
              </NumberedSection>

              <NumberedSection id="file-grade" number={sectionNumber("file-grade")} eyebrow="Source file" title="Which source types are linked"
                intro="A letter for how many kinds of original source sit in our file. It is about coverage, not about the compound.">
                <ResearchFileGradeCard subject={subject} compact bare />
              </NumberedSection>
            </div>
          )}

          {subject && (
            <NumberedSection id="studies" number={sectionNumber("studies")} eyebrow="Studies" title="What the registered studies record"
              intro="Original registry facts and exact citation links. A registered study is not a result.">
              {isPex && <PexEvidencePassport />}
              {isPex ? (
                <div id="passport-studies" className="scroll-mt-36">
                  <p className={UI.eyebrowMuted}>Registered studies</p>
                  <h3 className={UI.h3 + " mt-1"}>The registry, re-read on request</h3>
                  <p className={UI.small + " mt-2 max-w-3xl"}>{PEX_REGISTRY_NOTE}</p>
                  <div className="mt-4"><Suspense fallback={<PexTrialNetworkLoading />}><PexTrialNetworkLive headless /></Suspense></div>
                </div>
              ) : subject.sampleTrial ? (
                <Suspense fallback={<TrialEvidenceLoading nctId={subject.sampleTrial} />}><DossierTrialEvidence subject={subject} /></Suspense>
              ) : (
                <p className={quiet + " text-sm font-medium leading-7 text-[#3a3d46]"}>No registered study is pinned to {subject.name} in this file yet. Use the registry search under Sources to look for one.</p>
              )}
              {subject.sampleTrial && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-extrabold text-[#2b31d8]">
                  <Link href={"/intelligence/studies/" + subject.sampleTrial} className="inline-flex min-h-6 items-center gap-1 hover:underline">Audit this trial <ArrowUpRight className="size-4" /></Link>
                  {subject.legacyTopic && <Link href={"/intelligence/" + subject.legacyTopic} className="inline-flex min-h-6 items-center gap-1 hover:underline">Additional source samples <ArrowUpRight className="size-4" /></Link>}
                </div>
              )}
              {(isPex || subject.slug === "magainin-2") && (
                <Quiet>
                  <h3 className={UI.h4}>Guided source review · Magainin 2 vs pexiganan</h3>
                  <p className={UI.bodyInk + " mt-2"}>Follow an original lipid-bilayer experiment to a separately registered clinical trial. See which observations come from which source, and why the compounds cannot be treated as interchangeable.</p>
                  <Link href="/intelligence/cases/magainin-pexiganan" className={UI.link + " mt-3"}>Open guided evidence workpaper <ArrowRight className="size-4" /></Link>
                </Quiet>
              )}
            </NumberedSection>
          )}

          {subject && (
            <div className="grid items-start gap-4 xl:grid-cols-2">
              <NumberedSection id="sources" number={sectionNumber("sources")} eyebrow="Sources" title="Follow the source trail"
                intro="Every row links to the original record. Search results have not been individually evaluated as evidence.">
                {isPex ? <div className="grid gap-3"><p className={UI.small + " max-w-3xl"}>{PEX_REGISTER_NOTE}</p><PexSourceRegister /></div> : (
                  <ul className="divide-y divide-[#111214]/10 rounded-[14px] border border-[#111214]/15">
                    {[
                      { href: subject.referenceUrl, icon: CheckCircle2, title: "Molecular identity", note: subject.referenceLabel + " · Checked 18 Oct 2026", action: "Open PubChem" },
                      { href: verifiedPubmedSearchUrl(subject), icon: BookOpen, title: "Find original publications", note: "PubMed search. Mentions and reviews are not necessarily direct trial results.", action: "Search PubMed" },
                      { href: registryDiscoveryUrl(subject), icon: FileSearch, title: "Find registered studies", note: "Registry keyword search. Returned trials may study another compound or a combination.", action: "Search ClinicalTrials.gov" },
                    ].map(({ href, icon: Icon, title, note, action }) => (
                      <li key={title}>
                        <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 px-5 py-4 hover:bg-[#eef0ff]">
                          <Icon className="mt-0.5 size-5 shrink-0 text-[#2b31d8]" aria-hidden="true" />
                          <span className="min-w-0"><span className="block text-sm font-extrabold">{title}</span><span className="mt-0.5 block text-xs font-medium leading-5 text-[#4a4d56]">{note}</span><span className="mt-1.5 inline-flex items-center gap-1 text-xs font-extrabold text-[#2b31d8]">{action} <ArrowUpRight className="size-3.5" aria-hidden="true" /></span></span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {/* The id sits outside the Suspense boundary so /compounds/<slug>#organizations can land on it
                    before the panel streams in (the old sponsor page forwards here). */}
                <div id="organizations" className="scroll-mt-40"><Suspense fallback={<OrganizationsLoading />}><DossierOrganizations subject={subject} /></Suspense></div>
              </NumberedSection>

              <NumberedSection id="material-evidence" number={sectionNumber("material-evidence")} eyebrow="Materials" title="Sample verification: not yet authenticated"
                intro="The molecular record and the file letter do not establish the identity, authenticity or analytical quality of a physical lot.">
                {isPex && <PexNoLabVerification />}
                <div className="flex flex-wrap items-center gap-3">
                  <Pill href={"/intelligence/materials?subject=" + encodeURIComponent(subject.slug)} icon={ClipboardCheck} arrow="right">Open material checks</Pill>
                  <Link href="/intelligence/materials#material-providers" className={UI.link}>Company-published QC documentation <ArrowUpRight className="size-4" /></Link>
                  {isPex && <Link href="/intelligence/desk" className={UI.link}>Build a briefing in the Research Desk <ArrowUpRight className="size-4" /></Link>}
                </div>
                {compound && showCatalog && (labTests.length || passports.length) ? (
                  <p className={UI.small}>Independent certificates and batch records on file for {name} sit under Lab tests below; they describe tested samples, not the file&rsquo;s identity record.</p>
                ) : null}
              </NumberedSection>
            </div>
          )}

          {/* ── The catalog record ───────────────────────────────────────────────────────── */}
          {edu && compound ? (
            <CompoundKnowledge id="understand" number={sectionNumber("understand")} name={compound.name} education={edu} depth={depthFor(slug)} showStacks={false} />
          ) : null}

          {vendorEntries.length ? <CompoundVendors vendors={vendorEntries} compoundName={name} number={sectionNumber("vendors")} /> : null}

          {/* THE market surface (legacy release only). The leaderboard brings its own page container,
              so this block steps out of the section's padding to line up with it. */}
          {compound && showMarket ? (
            /* min-w-0: a grid item is as wide as its widest child by default, and the table's
               minimum width would stretch the whole page on a phone instead of scrolling in its box. */
            <div id="market" className="-mx-5 min-w-0 scroll-mt-36 sm:-mx-8">
              <div className={UI.container + " pt-2"}>
                {evidenceOnly ? (
                  /* The market record: what was listed and what it cost on the day we read it, each
                     row citing the listing. The full-market and product pages stay closed here. */
                  <SectionHeading eyebrow="Market record" title={`What ${compound.name} listings show, and when we read them`}
                    lead={<>Every {compound.name} listing on record &mdash; {listings.length} in all &mdash; with the price as it read on the day we read it and, where a vendor&rsquo;s website link is released, the listing it was read from. Recorded for reference alongside the lab evidence above: VialGrade sells nothing and takes no referrals, and a price is not a recommendation or an assurance of product identity, safety or lawful sale.</>} />
                ) : (
                  <SectionHeading eyebrow="Current market" title={`The ${compound.name} market`}
                    lead={<>Every {compound.name} listing we track &mdash; {listings.length} in all. Historical prices are shown with evidence and data quality limitations. Prices do not amount to a recommendation or an assurance of product identity, safety or lawful sale.</>}
                    action={<Pill href={`/compounds/${slug}/market`} variant="ink" arrow="right">Open full market</Pill>} />
                )}
              </div>
              <PriceLeaderboard compoundName={compound.name} marketHref={evidenceOnly ? undefined : `/compounds/${slug}/market`} listings={listings} labTests={labTests}
                record={evidenceOnly ? { websiteByVendor } : undefined} />
            </div>
          ) : null}

          {labTests.length || passports.length ? (
            <LabTestsPanel id="lab-tests" number={sectionNumber("lab-tests")} tests={labTests} heading={`${name} — independent lab tests`}>
              {passports.length ? <PassportCarousel passports={passports} compoundName={name} /> : null}
            </LabTestsPanel>
          ) : null}

          {compound && showCatalog && (research.length || regulatory) ? (
            <CompoundResearchPanel id="research" number={sectionNumber("research")} findings={research} regulatoryStatus={regulatory?.regulatory_status ?? null} evidenceSummary={regulatory?.evidence_summary ?? null} compoundName={compound.name} fdaApprovedDrugExists={regulatory?.fda_approved_drug_exists ?? null} />
          ) : null}

          {compound && showCatalog ? <InnovatorNote slug={slug} compoundName={compound.name} /> : null}

          {compound && (stacked.length || inStacks.length) ? (
            <NumberedSection id="stacked" number={sectionNumber("stacked")} eyebrow="Commonly researched together" title={`Often stacked with ${compound.name}`}
              intro={`Compounds the research community frequently discusses alongside ${compound.name}. Not a protocol or a recommendation — a starting point for what to read about next.`}
              chips={inStacks.length ? (
                <>
                  <span className={UI.eyebrowMuted + " self-center"}>Part of</span>
                  {/* The stack pages are closed under the evidence-only release, so the names stay
                      as plain chips there; the legacy site keeps the links. */}
                  {inStacks.map((s) => noCommerce
                    ? <Chip key={s.slug} plain>{s.name} <span className="font-bold text-[var(--muted)]">· {s.kind}</span></Chip>
                    : <Link key={s.slug} href={`/stacks/${s.slug}`} className="ink-1 inline-flex min-h-7 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-[#111214] transition-colors hover:bg-[#eef0ff]">{s.name} <span className="font-bold text-[var(--muted)]">· {s.kind}</span></Link>)}
                </>
              ) : undefined}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stacked.map((c) => {
                  const cEdu = educationFor(c.slug);
                  return (
                    <Link key={c.slug} href={`/compounds/${c.slug}`} className="ink hard-sm press group flex flex-col gap-3 rounded-[18px] bg-white p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-extrabold tracking-[-.03em] text-[#111214]">{c.name}</p>
                          <p className="mt-0.5 text-xs font-bold text-[var(--muted)]">{c.category}</p>
                        </div>
                        {noMarket ? null : <span className="shrink-0 text-right text-sm font-extrabold tabular-nums text-[#111214]">{c.listings > 0 ? formatCurrency(c.medianPrice) : "—"}<span className="mt-0.5 block text-[10px] font-bold text-[var(--muted)]">{c.listings > 0 ? "median" : "no listings"}</span></span>}
                      </div>
                      {cEdu?.goals?.length ? <GoalTags goals={cEdu.goals} limit={2} /> : null}
                      {cEdu?.summary ? <p className="line-clamp-2 text-xs font-medium leading-5 text-[#4a4d56]">{cEdu.summary}</p> : null}
                    </Link>
                  );
                })}
              </div>
            </NumberedSection>
          ) : null}

          {/* ── Limits last ──────────────────────────────────────────────────────────────── */}
          {subject && (
            <NumberedSection id="related" number={sectionNumber("related")} eyebrow="Limits and related" title="What still needs checking">
              <p className={UI.bodyInk + " leading-7"}>{subject.identityCaveat}</p>
              <p className={UI.bodyInk + " leading-7"}>{subject.nextReview}</p>
              <div>
                <h3 className={UI.eyebrowMuted}>Related research directions</h3>
                <ul className="mt-2 divide-y divide-[#111214]/10 rounded-[14px] border border-[#111214]/15">
                  {related.map((other) => (
                    <li key={other.slug}><Link href={"/compounds/" + other.slug} className="flex min-h-11 items-center justify-between gap-3 px-5 py-3 text-sm font-extrabold hover:bg-[#eef0ff]">{other.name} <ArrowRight className="size-4 text-[#2b31d8]" aria-hidden="true" /></Link></li>
                  ))}
                </ul>
                <Link href="/compounds#browse" className={UI.linkSmall + " mt-3"}><ArrowLeft className="size-3" aria-hidden="true" /> Back to discovery</Link>
              </div>
            </NumberedSection>
          )}

          {isPex && <div id="pexiganan-network" className="scroll-mt-36"><PexEvidenceWayfinder /></div>}

          {compound && showCatalog ? <UsLegalNotice slug={slug} /> : null}

          {compound && showCatalog ? (
            <Notice tone="warn" icon={CircleAlert}>
              <h2 className={UI.h4}>Research notes aren&rsquo;t product proof</h2>
              <p className="mt-1 max-w-3xl">{compound.researchNote}</p>
            </Notice>
          ) : null}

          {subject && (
            <p className={UI.small + " max-w-4xl leading-6"}>
              Editorial research starting points, not grades of clinical effectiveness or material quality. Company-published supplier QC information is separate and unverified; no prices, purchases or recommendations for human consumption.
            </p>
          )}
        </ContentsLayout>
      </Section>
    </div>
  );
}
