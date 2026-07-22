import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FlaskConical, MapPin, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { getLabsOverview } from "@/server/labs/repository";
import type { LabIndependence } from "@/server/labs/registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Testing laboratories", description: "The real third-party labs behind the certificates — who they are, whether they're independent and accredited, and what they've tested. Sourced, hedged, never an endorsement." };

const INDEP: Record<LabIndependence, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
  independent: { label: "Independent lab", cls: "text-emerald-700 bg-emerald-50 border-emerald-200", Icon: ShieldCheck },
  "independence-unverified": { label: "Independence unverified", cls: "text-amber-700 bg-amber-50 border-amber-200", Icon: ShieldQuestion },
  unverified: { label: "Unverified lab", cls: "text-rose-700 bg-rose-50 border-rose-200", Icon: ShieldAlert },
};

function accreditationLabel(a: { iso17025: boolean | null; scopeCoversPeptides: boolean | null; status: string }): string {
  if (a.iso17025 === true) return a.scopeCoversPeptides === false ? "ISO 17025 — but not for peptides" : a.status === "verified-against-accreditor" ? "ISO 17025 (verified)" : "ISO 17025 (reported)";
  return "No accreditation on record";
}

export default async function Page() {
  const labs = await getLabsOverview();
  return <div>
    <section className="border-b border-black/[.06]"><div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-cyan-700">The testing laboratories</p>
      <h1 className="mt-4 max-w-5xl text-5xl font-semibold tracking-[-.065em] sm:text-7xl">Who actually runs the tests.</h1>
      <p className="mt-6 max-w-3xl text-base leading-7 text-black/55">Every certificate names a lab. Here is what we could verify about each one — whether it&rsquo;s a real, independent third-party lab, whether it holds accreditation (and whether that accreditation even covers peptides), and how much evidence flows through it. We only call a lab &ldquo;independent&rdquo; when we&rsquo;ve confirmed it. Everything is sourced; naming a lab is never an endorsement.</p>
    </div></section>
    <section className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
      <div className="grid gap-5 lg:grid-cols-2">{labs.map(({ profile: l, usage }) => { const tier = INDEP[l.independence]; return (
        <Link key={l.slug} href={`/labs/${l.slug}`} className="group rounded-[30px] border border-black/[.07] bg-white p-7 transition hover:-translate-y-1 hover:shadow-xl">
          <div className="flex items-start justify-between gap-5">
            <div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tier.cls}`}><tier.Icon className="size-3.5" />{tier.label}</span>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-.04em]">{l.displayName}</h2>
              <p className="mt-2 flex items-center gap-2 text-sm text-black/45"><MapPin className="size-4" />{l.country || "Location not published"}</p>
            </div>
            <span className="grid size-12 place-items-center rounded-2xl bg-cyan-50"><FlaskConical className="size-5 text-cyan-700" /></span>
          </div>
          <p className="mt-4 text-sm leading-6 text-black/55">{l.independence !== "independent" ? l.independentNote : l.reputation}</p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-black/[.03] p-4"><p className="text-[10px] uppercase text-black/35">Certificates</p><p className="mt-1 text-xl font-semibold tabular-nums">{usage.coaCount}</p></div>
            <div className="rounded-2xl bg-black/[.03] p-4"><p className="text-[10px] uppercase text-black/35">Vendors</p><p className="mt-1 text-xl font-semibold tabular-nums">{usage.vendorCount}</p></div>
            <div className="rounded-2xl bg-black/[.03] p-4"><p className="text-[10px] uppercase text-black/35">Accreditation</p><p className="mt-1 text-[13px] font-semibold leading-tight">{accreditationLabel(l.accreditation)}</p></div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold">What we verified <BadgeCheck className="size-4 transition group-hover:translate-x-1" /></div>
        </Link>); })}</div>
      <div className="mt-8 rounded-[28px] bg-[#111214] p-7 text-white"><ShieldCheck className="size-5 text-cyan-300" />
        <h2 className="mt-5 text-3xl font-semibold tracking-[-.05em]">Accreditation is not a rubber stamp.</h2>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-white/55">ISO/IEC 17025 is method- and scope-specific: a lab can be genuinely accredited for food microbiology or heavy metals and still run its peptide purity tests <em>outside</em> that accredited scope. Where that&rsquo;s the case, we say so. Most peptide-market labs hold no accreditation at all and operate as harm-reduction services — useful, but not regulatory-grade QC. We report what each lab can and can&rsquo;t back, and we never repeat a vendor&rsquo;s accreditation claim as fact.</p>
      </div>
    </section>
  </div>;
}
