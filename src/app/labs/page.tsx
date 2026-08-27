import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FlaskConical, MapPin, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { getLabsOverview, type LabUsage } from "@/server/labs/repository";
import type { LabIndependence, LabProfile } from "@/server/labs/registry";
import { DataUnavailable } from "@/components/home-data-unavailable";
import { reportError } from "@/server/observability/alerts";
import { filterLabs, hasActiveLabFilters, offeredLabFacets, partitionLabsByEvidence } from "@/lib/labs-filter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Testing laboratories", description: "The real third-party labs behind the certificates — who they are, whether they're independent and accredited, and what they've tested. Sourced, hedged, never an endorsement.", alternates: { canonical: "/labs" } };

const INDEP: Record<LabIndependence, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
  independent: { label: "Independent lab", cls: "text-[#0e8f80] bg-[#e6fbf4]", Icon: ShieldCheck },
  "independence-unverified": { label: "Independence unverified", cls: "text-[#b26a00] bg-[#fff4e0]", Icon: ShieldQuestion },
  unverified: { label: "Unverified lab", cls: "text-[#d3372c] bg-[#fff1f0]", Icon: ShieldAlert },
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

  return <div>
    <section className="border-b-2 border-[#111214]/10"><div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#0e8f80]">The testing laboratories</p>
      <h1 className="mt-4 max-w-5xl text-5xl font-extrabold tracking-[-.065em] sm:text-7xl">Who actually runs the tests.</h1>
      <p className="mt-6 max-w-3xl text-base font-medium leading-7 text-[var(--muted)]">Every certificate names a lab. Here is what we could verify about each one &mdash; whether it&rsquo;s a real, independent third-party lab, whether it holds accreditation (and whether that accreditation even covers peptides), and how much evidence flows through it. We only call a lab &ldquo;independent&rdquo; when we&rsquo;ve confirmed it. Everything is sourced; naming a lab is never an endorsement.</p>
    </div></section>
    <section className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {/* "Every lab" always renders — it is the only way back to the whole registry. */}
          <Link href={href()} aria-current={active ? undefined : "page"}
            className={`ink-1 press rounded-full px-4 py-2 text-sm font-bold ${active ? "bg-white" : "bg-[#111214] text-white"}`}>
            Every lab <span className={active ? "text-[var(--muted)]" : "text-white/60"}>{rows.length}</span>
          </Link>
          {facets.map((facet) => {
            const on = sp.independence === facet.id;
            return <Link key={facet.id} href={href(facet.id)} title={facet.note} aria-current={on ? "page" : undefined}
              className={`ink-1 press rounded-full px-4 py-2 text-sm font-bold ${on ? "bg-[#111214] text-white" : "bg-white"}`}>
              {facet.label} <span className={on ? "text-white/60" : "text-[var(--muted)]"}>{facet.count}</span>
            </Link>;
          })}
        </div>
        <p className="text-sm font-medium text-[var(--muted)]" data-testid="labs-count">
          <span className="font-extrabold tabular-nums text-black">{filtered.length}</span> lab{filtered.length === 1 ? "" : "s"}
          {active && <span className="tabular-nums"> of {rows.length}</span>}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="ink hard mt-8 rounded-[20px] bg-white px-6 py-16 text-center">
          <p className="text-lg font-extrabold">No lab in the registry is in that tier.</p>
          <Link href={href()} className="ink hard-sm press mt-6 inline-flex rounded-full bg-[#111214] px-5 py-2.5 text-sm font-bold text-white">Show every lab</Link>
        </div>
      ) : (
        <>
          {tested.length > 0 && (
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              {tested.map(({ profile, usage }) => <LabCard key={profile.slug} lab={profile} usage={usage} />)}
            </div>
          )}

          {untested.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-extrabold tracking-[-.04em]">In the registry, but no certificates here yet</h2>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
                We have researched {untested.length === 1 ? "this lab" : "these labs"} and hold what we could verify about {untested.length === 1 ? "it" : "them"} &mdash; but no certificate naming {untested.length === 1 ? "it" : "them"} has reached our records. That is a statement about our coverage, not about the lab&rsquo;s work, and it is not a reason to distrust a certificate you hold from {untested.length === 1 ? "it" : "one of them"}. We list {untested.length === 1 ? "it" : "them"} so you can still check what we know before you trust a document.
              </p>
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                {untested.map(({ profile, usage }) => <LabCard key={profile.slug} lab={profile} usage={usage} />)}
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-8 ink hard rounded-[20px] bg-[#111214] p-7 text-white"><ShieldCheck className="size-5 text-[#8fffd6]" />
        <h2 className="mt-5 text-3xl font-extrabold tracking-[-.05em]">Accreditation is not a rubber stamp.</h2>
        <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-white/70">ISO/IEC 17025 is method- and scope-specific: a lab can be genuinely accredited for food microbiology or heavy metals and still run its peptide purity tests <em>outside</em> that accredited scope. Where that&rsquo;s the case, we say so. Most peptide-market labs hold no accreditation at all and operate as harm-reduction services &mdash; useful, but not regulatory-grade QC. We report what each lab can and can&rsquo;t back, and we never repeat a vendor&rsquo;s accreditation claim as fact.</p>
      </div>
    </section>
  </div>;
}

function LabCard({ lab: l, usage }: { lab: LabProfile; usage: LabUsage }) {
  const tier = INDEP[l.independence];
  // A lab we hold nothing from does NOT get the "Certificates 0 / Vendors 0" tiles. Two zeroes
  // rendered in the same slot where another lab shows 400 reads as a measurement of this lab, and
  // implies we weighed evidence we never held. It gets a sentence instead, which is the truth.
  const hasEvidence = usage.coaCount > 0;
  return (
    <Link href={`/labs/${l.slug}`} className="group ink hard press rounded-[20px] bg-white p-7">
      <div className="flex items-start justify-between gap-5">
        <div>
          <span className={`inline-flex items-center gap-1.5 ink-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${tier.cls}`}><tier.Icon className="size-3.5" />{tier.label}</span>
          <h2 className="mt-3 text-2xl font-extrabold tracking-[-.04em]">{l.displayName}</h2>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-[var(--muted)]"><MapPin className="size-4" />{l.country || "Location not published"}</p>
        </div>
        <span className="ink-1 grid size-12 place-items-center rounded-[14px] bg-[#e6fbf4]"><FlaskConical className="size-5 text-[#0e8f80]" /></span>
      </div>
      <p className="mt-4 text-sm font-medium leading-6 text-[var(--muted)]">{l.independence !== "independent" ? l.independentNote : l.reputation}</p>
      {hasEvidence ? (
        <div className="mt-6 grid grid-cols-3 gap-3">
          {/* Scoped to our records in the label, not just in the tooltip: the number is how much of
              this lab's work has reached VialGrade, never how much work the lab has done. */}
          <div className="ink-1 rounded-[12px] bg-[#f7f7f4] p-4"><p className="text-[10px] uppercase text-[var(--muted)]">Certificates here</p><p className="mt-1 text-xl font-extrabold tabular-nums">{usage.coaCount}</p></div>
          <div className="ink-1 rounded-[12px] bg-[#f7f7f4] p-4"><p className="text-[10px] uppercase text-[var(--muted)]">Vendors here</p><p className="mt-1 text-xl font-extrabold tabular-nums">{usage.vendorCount}</p></div>
          <div className="ink-1 rounded-[12px] bg-[#f7f7f4] p-4"><p className="text-[10px] uppercase text-[var(--muted)]">Accreditation</p><p className="mt-1 text-[13px] font-bold leading-tight">{accreditationLabel(l.accreditation)}</p></div>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="ink-1 rounded-[12px] bg-[#fff4e0] p-4">
            <p className="text-[10px] uppercase text-[#b26a00]">Evidence on VialGrade</p>
            <p className="mt-1 text-[13px] font-bold leading-tight">No certificate naming this lab has reached our records</p>
          </div>
          <div className="ink-1 rounded-[12px] bg-[#f7f7f4] p-4"><p className="text-[10px] uppercase text-[var(--muted)]">Accreditation</p><p className="mt-1 text-[13px] font-bold leading-tight">{accreditationLabel(l.accreditation)}</p></div>
        </div>
      )}
      <div className="mt-6 flex items-center gap-2 text-sm font-bold">What we verified <BadgeCheck className="size-4 transition group-hover:translate-x-1" /></div>
    </Link>
  );
}
