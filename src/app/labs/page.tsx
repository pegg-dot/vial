import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FlaskConical, MapPin, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { getLabsOverview, type LabUsage } from "@/server/labs/repository";
import type { LabIndependence, LabProfile } from "@/server/labs/registry";
import { DataUnavailable } from "@/components/home-data-unavailable";
import { Chip, Frame, IconTile, Notice, PageHero, Pill, Quiet, Section, SectionHeading, StatRow, UI, type Tone } from "@/components/intelligence/research-ui";
import { reportError } from "@/server/observability/alerts";
import { filterLabs, hasActiveLabFilters, offeredLabFacets, partitionLabsByEvidence } from "@/lib/labs-filter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Testing laboratories", description: "The real third-party labs behind the certificates — who they are, whether they're independent and accredited, and what they've tested. Sourced, hedged, never an endorsement.", alternates: { canonical: "/labs" } };

// The tier is a kind of fact, so the chip tone says which: confirmed (mint), unconfirmed (warn),
// could not confirm the lab exists (danger).
const INDEP: Record<LabIndependence, { label: string; tone: Tone; Icon: typeof ShieldCheck }> = {
  independent: { label: "Independent lab", tone: "mint", Icon: ShieldCheck },
  "independence-unverified": { label: "Independence unverified", tone: "warn", Icon: ShieldQuestion },
  unverified: { label: "Unverified lab", tone: "danger", Icon: ShieldAlert },
};

function accreditationLabel(a: { iso17025: boolean | null; scopeCoversPeptides: boolean | null; status: string }): string {
  if (a.iso17025 === true) return a.scopeCoversPeptides === false ? "ISO 17025 — but not for peptides" : a.status === "verified-against-accreditor" ? "ISO 17025 (verified)" : "ISO 17025 (reported)";
  return "No accreditation on record";
}

export default async function Page({ searchParams }: { searchParams: Promise<{ independence?: string }> }) {
  const sp = await searchParams;
  const labs = await getLabsOverview().catch((error) => {
    reportError({ kind: "labs-unavailable", message: "The laboratory overview could not be read.", context: { error: String(error) } });
    return null;
  });
  if (!labs) return <DataUnavailable surface="the laboratory directory" />;

  // The page's whole subject is confirmed-independent vs not, and it had no way to ask that
  // question. URL-driven so the filter survives a reload and can be linked, and so this stays a
  // server component.
  const rows = labs.map(({ profile, usage }) => ({ slug: profile.slug, independence: profile.independence, coaCount: usage.coaCount, profile, usage }));
  const filters = { independence: sp.independence };
  // Counts are taken over the WHOLE registry so a chip's number never shifts under the pointer.
  const facets = offeredLabFacets(rows);
  const filtered = filterLabs(rows, filters);
  const active = hasActiveLabFilters(filters);
  // A lab we have vetted but hold no certificates from is worth listing — a reader holding a COA
  // from it is exactly who this page is for. It is NOT worth listing beside a lab with hundreds of
  // certificates under the same "Certificates / Vendors" tiles, where a 0 reads as a measurement of
  // the lab instead of a statement about our records. So they are named and kept apart.
  const { tested, untested } = partitionLabsByEvidence(filtered);
  const href = (independence?: string) => (independence ? `/labs?independence=${independence}` : "/labs");
  // Masthead figures over the whole registry, never the filtered view.
  const confirmed = rows.filter((row) => row.independence === "independent").length;
  const certificates = rows.reduce((sum, row) => sum + row.coaCount, 0);

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["flask", "magnifier"]}
        breadcrumb={[{ href: "/intelligence/market", label: "Research Market" }, { label: "Labs" }]}
        eyebrow={<><FlaskConical className="size-4" aria-hidden="true" /> The testing laboratories</>}
        title="Who actually runs the tests."
        lead={<>Every certificate names a lab. Here is what we could verify about each one &mdash; whether it&rsquo;s a real, independent third-party lab, whether it holds accreditation (and whether that accreditation even covers peptides), and how much evidence flows through it.</>}
        note={<>We only call a lab &ldquo;independent&rdquo; when we&rsquo;ve confirmed it. Everything is sourced; naming a lab is never an endorsement.</>}>
        <StatRow className="mt-8" items={[
          { value: rows.length, label: "Labs in the registry" },
          { icon: ShieldCheck, value: confirmed, label: "Confirmed independent" },
          { value: certificates, label: "Certificates on VialGrade" },
        ]} />
      </PageHero>

      <Section tight>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {/* "Every lab" always renders — it is the only way back to the whole registry. */}
            <TierLink href={href()} current={!active}>
              Every lab <span className={active ? "text-[var(--muted)]" : "text-white/60"}>{rows.length}</span>
            </TierLink>
            {facets.map((facet) => {
              const on = sp.independence === facet.id;
              return (
                <TierLink key={facet.id} href={href(facet.id)} title={facet.note} current={on}>
                  {facet.label} <span className={on ? "text-white/60" : "text-[var(--muted)]"}>{facet.count}</span>
                </TierLink>
              );
            })}
          </div>
          <p className={UI.body} data-testid="labs-count">
            <span className="font-extrabold tabular-nums text-[#111214]">{filtered.length}</span> lab{filtered.length === 1 ? "" : "s"}
            {active && <span className="tabular-nums"> of {rows.length}</span>}
          </p>
        </div>

        {filtered.length === 0 ? (
          <Frame pad="lg" className="mt-8 py-16 text-center">
            <p className={UI.h3}>No lab in the registry is in that tier.</p>
            <div className="mt-6"><Pill href={href()} variant="ink">Show every lab</Pill></div>
          </Frame>
        ) : (
          <>
            {tested.length > 0 && (
              <div className="mt-8 grid gap-5 lg:grid-cols-2">
                {tested.map(({ profile, usage }) => <LabCard key={profile.slug} lab={profile} usage={usage} />)}
              </div>
            )}

            {untested.length > 0 && (
              <div className="mt-12">
                <SectionHeading title="In the registry, but no certificates here yet"
                  lead={<>We have researched {untested.length === 1 ? "this lab" : "these labs"} and hold what we could verify about {untested.length === 1 ? "it" : "them"} &mdash; but no certificate naming {untested.length === 1 ? "it" : "them"} has reached our records. That is a statement about our coverage, not about the lab&rsquo;s work, and it is not a reason to distrust a certificate you hold from {untested.length === 1 ? "it" : "one of them"}. We list {untested.length === 1 ? "it" : "them"} so you can still check what we know before you trust a document.</>} />
                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  {untested.map(({ profile, usage }) => <LabCard key={profile.slug} lab={profile} usage={usage} />)}
                </div>
              </div>
            )}
          </>
        )}

        <Notice tone="warn" icon={ShieldCheck} className="mt-8">
          <h2 className={UI.h4}>Accreditation is not a rubber stamp.</h2>
          <p className="mt-2 max-w-3xl">ISO/IEC 17025 is method- and scope-specific: a lab can be genuinely accredited for food microbiology or heavy metals and still run its peptide purity tests <em>outside</em> that accredited scope. Where that&rsquo;s the case, we say so. Most peptide-market labs hold no accreditation at all and operate as harm-reduction services &mdash; useful, but not regulatory-grade QC. We report what each lab can and can&rsquo;t back, and we never repeat a vendor&rsquo;s accreditation claim as fact.</p>
        </Notice>
      </Section>
    </div>
  );
}

function TierLink({ href, current, title, children }: { href: string; current: boolean; title?: string; children: React.ReactNode }) {
  return <Pill href={href} title={title} ariaCurrent={current ? "page" : undefined} variant={current ? "ink" : "ghost"}>{children}</Pill>;
}

function LabCard({ lab: l, usage }: { lab: LabProfile; usage: LabUsage }) {
  const tier = INDEP[l.independence];
  // A lab we hold nothing from does NOT get the "Certificates 0 / Vendors 0" tiles. Two zeroes
  // rendered in the same slot where another lab shows 400 reads as a measurement of this lab, and
  // implies we weighed evidence we never held. It gets a sentence instead, which is the truth.
  const hasEvidence = usage.coaCount > 0;
  return (
    <Link href={`/labs/${l.slug}`} className="ink hard press group flex h-full flex-col rounded-[18px] bg-white p-6">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <Chip tone={tier.tone} icon={tier.Icon}>{tier.label}</Chip>
          <h2 className={UI.h3 + " mt-3"}>{l.displayName}</h2>
          <p className={UI.body + " mt-2 flex items-center gap-2"}><MapPin className="size-4" aria-hidden="true" />{l.country || "Location not published"}</p>
        </div>
        <IconTile icon={FlaskConical} tone="mint" />
      </div>
      <p className={UI.body + " mt-4"}>{l.independence !== "independent" ? l.independentNote : l.reputation}</p>
      {hasEvidence ? (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {/* Scoped to our records in the label, not just in the tooltip: the number is how much of
              this lab's work has reached VialGrade, never how much work the lab has done. */}
          <Quiet><p className={UI.eyebrowMuted}>Certificates here</p><p className="mt-1 text-xl font-extrabold tabular-nums">{usage.coaCount}</p></Quiet>
          <Quiet><p className={UI.eyebrowMuted}>Vendors here</p><p className="mt-1 text-xl font-extrabold tabular-nums">{usage.vendorCount}</p></Quiet>
          <Quiet><p className={UI.eyebrowMuted}>Accreditation</p><p className="mt-1 text-[13px] font-bold leading-tight">{accreditationLabel(l.accreditation)}</p></Quiet>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Notice tone="warn" title="Evidence on VialGrade"><p className="text-[13px] leading-5">No certificate naming this lab has reached our records</p></Notice>
          <Quiet><p className={UI.eyebrowMuted}>Accreditation</p><p className="mt-1 text-[13px] font-bold leading-tight">{accreditationLabel(l.accreditation)}</p></Quiet>
        </div>
      )}
      <span className="mt-auto inline-flex items-center gap-1 pt-5 text-xs font-bold text-[#2b31d8]">
        What we verified <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </span>
    </Link>
  );
}
