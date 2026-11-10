import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, ShieldQuestion, ArrowUpRight, FlaskConical, EyeOff, MapPin, AlertTriangle } from "lucide-react";
import { getLabDetail } from "@/server/labs/repository";
import { LAB_REGISTRY, type LabIndependence } from "@/server/labs/registry";
import { PURITY_PROVENANCE_SHORT } from "@/lib/provenance-copy";
import { Chip, Frame, NumberedSection, PageHero, Pill, Quiet, Section, Stat, TONE_ACCENT, UI, type Tone } from "@/components/intelligence/research-ui";

export const dynamic = "force-dynamic";

// Whether a lab is independent is the single most consequential fact on the page, so it belongs in
// the description rather than a generic "lab profile" line — someone searching a lab name is
// usually trying to find out exactly that. Read from the static registry rather than getLabDetail
// so resolving metadata costs no extra database queries on top of the ones the page already runs.
const INDEPENDENCE_SUMMARY: Record<LabIndependence, string> = {
  independent: "Confirmed independent of the vendors it tests",
  "independence-unverified": "A real lab, but its independence from vendors is unconfirmed",
  unverified: "Not confirmed to be a real, independent laboratory",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = LAB_REGISTRY.find((lab) => lab.slug === slug);
  if (!profile) return {};
  const where = profile.country ? ` Based in ${profile.country}.` : "";
  return {
    title: `${profile.displayName} — testing laboratory`,
    description: `${INDEPENDENCE_SUMMARY[profile.independence]}.${where} What it tests, its accreditation status, and the certificates VialGrade holds from it. Naming a lab is not an endorsement.`,
    alternates: { canonical: `/labs/${slug}` },
  };
}

// The tier is a kind of fact, so its tone says which: confirmed (mint), unconfirmed (warn), could
// not confirm the lab exists (danger).
const INDEP: Record<LabIndependence, { label: string; tone: Tone; Icon: typeof ShieldCheck; blurb: string }> = {
  independent: { label: "Confirmed independent lab", tone: "mint", Icon: ShieldCheck, blurb: "We confirmed this is a real, third-party laboratory that is independent of the vendors whose products it tests. Its certificates count as independent corroboration." },
  "independence-unverified": { label: "Independence unverified", tone: "warn", Icon: ShieldQuestion, blurb: "This is a real, operating lab, but we could not confirm it is independent of the vendors it serves. We show its certificates for transparency, but they do not count as confirmed independent corroboration." },
  unverified: { label: "Unverified lab", tone: "danger", Icon: ShieldAlert, blurb: "We could not confirm this is a real, independent laboratory. Its certificates are shown for transparency only and never counted as independent evidence." },
};

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getLabDetail(slug);
  if (!data) notFound();
  const { profile: l, usage, vendors, recentTests } = data;
  const tier = INDEP[l.independence];
  const a = l.accreditation;
  // The sections in their fixed order; the two evidence sections only exist when we hold evidence,
  // so the numbering is taken from what actually renders.
  const sections = ["accreditation", "methods", vendors.length > 0 ? "vendors" : null, recentTests.length > 0 ? "tests" : null, "sources"].filter((id): id is string => id !== null);
  const num = (id: string) => sections.indexOf(id) + 1;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero art={["flask", "coa"]}
        breadcrumb={[{ href: "/intelligence/market", label: "Research Market" }, { href: "/labs", label: "Labs" }, { label: l.displayName }]}
        eyebrow={<><FlaskConical className="size-4" aria-hidden="true" /> Testing laboratory <Chip tone={tier.tone} icon={tier.Icon}>{tier.label}</Chip></>}
        title={l.displayName}
        note={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {l.country && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden="true" />{l.country}</span>}
          {l.website && <a href={l.website} target="_blank" rel="noopener nofollow" className={UI.linkSmall}>{l.website.replace(/^https?:\/\//, "")}<ArrowUpRight className="size-3.5" aria-hidden="true" /></a>}
          {l.legalName && <span>{l.legalName}</span>}
        </span>}
        aside={
          <Frame as="aside" tone={tier.tone} ariaLabel="Independence status">
            <p className={"text-[11px] font-extrabold uppercase tracking-[.12em] " + TONE_ACCENT[tier.tone]}>Independence</p>
            <p className={UI.bodyInk + " mt-2"}>{tier.blurb}</p>
            {l.independence !== "independent" && l.independentNote && <p className={UI.bodyInk + " mt-3"}><span className="font-bold">Why: </span>{l.independentNote}</p>}
          </Frame>
        }
      />

      <Section tight>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={usage.coaCount} label="Certificates on VialGrade" />
            <Stat value={usage.vendorCount} label="Vendors tested" />
            <Stat value={usage.purityMedian != null ? `${usage.purityMedian.toFixed(1)}%` : "—"} label="Median purity" note={usage.purityMedian != null ? PURITY_PROVENANCE_SHORT : undefined} />
            <Stat value={l.verifyPortal ? "Yes" : "None"} label="Public verify portal"
              note={l.verifyPortal ? <a href={l.verifyPortal} target="_blank" rel="noopener nofollow" className={UI.linkSmall}>Open the portal<ArrowUpRight className="size-3.5" aria-hidden="true" /></a> : undefined} />
          </div>

          {/* Accreditation — the litigation-sensitive part, stated only with its verification status. */}
          <NumberedSection id="accreditation" number={num("accreditation")} eyebrow="Accreditation" title="What the accreditation record shows">
            <div className="flex flex-wrap items-center gap-2">
              {a.iso17025 === true
                ? <Chip plain tone={a.scopeCoversPeptides === false ? "warn" : "mint"} icon={a.scopeCoversPeptides === false ? AlertTriangle : ShieldCheck}>{a.standard}{a.body ? ` · ${a.body}` : ""}{a.number ? ` #${a.number}` : ""}</Chip>
                : <Chip plain icon={ShieldQuestion}>No accreditation on record</Chip>}
              <Chip tone="paper">{a.status.replaceAll("-", " ")}</Chip>
            </div>
            <p className={UI.body + " max-w-3xl"}>{a.note}</p>
          </NumberedSection>

          <NumberedSection id="methods" number={num("methods")} eyebrow="What it tests" title="Methods, default coverage and reputation">
            <div className="grid gap-3 md:grid-cols-2">
              <Quiet>
                <h3 className={UI.h4}>What it tests</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">{l.techniques.map((t) => <Chip key={t} plain tone="mint">{t}</Chip>)}</div>
                {l.doesNotTestByDefault.length > 0 && <p className={UI.small + " mt-4"}><span className="font-bold text-[#111214]">Not covered by a default certificate:</span> {l.doesNotTestByDefault.join(", ")}. A purity certificate does not establish these.</p>}
              </Quiet>
              <Quiet>
                <h3 className={UI.h4}>Reputation &amp; incidents</h3>
                <p className={UI.body + " mt-3"}>{l.reputation}</p>
                {l.incidents.map((i) => <p key={i} className="mt-3 flex gap-2 text-xs font-medium leading-5 text-[#9b6b22]"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{i}</p>)}
              </Quiet>
            </div>
          </NumberedSection>

          {vendors.length > 0 && (
            <NumberedSection id="vendors" number={num("vendors")} eyebrow="Vendors" title="Vendors this lab has tested"
              intro="By vendor slug, with the number of certificates on VialGrade from each.">
              <div className="flex flex-wrap gap-2">
                {vendors.map((v) => <Pill key={v.vendorSlug} href={`/vendors/${v.vendorSlug}`} variant="ghost" size="sm">{v.vendorSlug} <span className="text-[var(--muted)]">{v.coas}</span></Pill>)}
              </div>
            </NumberedSection>
          )}

          {recentTests.length > 0 && (
            <NumberedSection id="tests" number={num("tests")} eyebrow="Certificates" title="Recent certificates" flush
              intro="The newest certificates naming this lab in our records, blind purchases first.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-[#fbfbf8] text-[10px] uppercase tracking-[.12em] text-[var(--muted)]"><tr><th className="px-5 py-3 font-bold">Sample</th><th className="px-5 py-3 font-bold">Vendor</th><th className="px-5 py-3 font-bold">Purity</th><th className="px-5 py-3 font-bold"></th><th className="px-5 py-3 font-bold"></th></tr></thead>
                  <tbody className="divide-y divide-[#111214]/10">{recentTests.map((t, i) => <tr key={i}>
                    <td className="px-5 py-3 text-xs font-medium">{t.sampleName.slice(0, 46)}</td>
                    <td className="px-5 py-3 text-xs">{t.vendorSlug ? <Link href={`/vendors/${t.vendorSlug}`} className={UI.linkSmall}>{t.vendorSlug}</Link> : "—"}</td>
                    <td className="px-5 py-3">{t.purityPct != null ? <Chip plain tone="mint" className="tabular-nums">{t.purityPct.toFixed(2)}%</Chip> : <span className={UI.small}>See report</span>}</td>
                    <td className="px-5 py-3">{t.isBlind && <Chip tone="blue" icon={EyeOff}>Blind</Chip>}</td>
                    <td className="px-5 py-3"><a href={t.verifyUrl} target="_blank" rel="noopener nofollow" className={UI.linkSmall}>View<ArrowUpRight className="size-3.5" aria-hidden="true" /></a></td>
                  </tr>)}</tbody>
                </table>
              </div>
            </NumberedSection>
          )}

          <NumberedSection id="sources" number={num("sources")} eyebrow="Sources" title="Where this page comes from">
            <p className={UI.body + " max-w-3xl"}>Everything on this page is drawn from public records. Naming a lab is never an endorsement, and an accreditation is only as good as the specific method scope it covers.</p>
            <div className="flex flex-wrap gap-2">{l.sourceUrls.map((u) => <Pill key={u} href={u} external variant="ghost" size="sm" arrow="up">{new URL(u).hostname.replace(/^www\./, "")}</Pill>)}</div>
          </NumberedSection>
        </div>
      </Section>
    </div>
  );
}
