import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, ShieldQuestion, ExternalLink, FlaskConical, EyeOff, MapPin, Globe, AlertTriangle } from "lucide-react";
import { getLabDetail } from "@/server/labs/repository";
import type { LabIndependence } from "@/server/labs/registry";

export const dynamic = "force-dynamic";

const INDEP: Record<LabIndependence, { label: string; cls: string; Icon: typeof ShieldCheck; blurb: string }> = {
  independent: { label: "Confirmed independent lab", cls: "text-emerald-700 bg-emerald-50 border-emerald-200", Icon: ShieldCheck, blurb: "We confirmed this is a real, third-party laboratory that is independent of the vendors whose products it tests. Its certificates count as independent corroboration." },
  "independence-unverified": { label: "Independence unverified", cls: "text-amber-700 bg-amber-50 border-amber-200", Icon: ShieldQuestion, blurb: "This is a real, operating lab, but we could not confirm it is independent of the vendors it serves. We show its certificates for transparency, but they do not count as confirmed independent corroboration." },
  unverified: { label: "Unverified lab", cls: "text-rose-700 bg-rose-50 border-rose-200", Icon: ShieldAlert, blurb: "We could not confirm this is a real, independent laboratory. Its certificates are shown for transparency only and never counted as independent evidence." },
};

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getLabDetail(slug);
  if (!data) notFound();
  const { profile: l, usage, vendors, recentTests } = data;
  const tier = INDEP[l.independence];
  const a = l.accreditation;

  return <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-24">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-700">Testing laboratory</p>
    <div className="mt-3 flex flex-wrap items-start justify-between gap-6">
      <div>
        <h1 className="text-5xl font-semibold tracking-[-.065em] sm:text-7xl">{l.displayName}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-black/55">
          {l.country && <span className="flex items-center gap-1.5"><MapPin className="size-4" />{l.country}</span>}
          {l.website && <a href={l.website} target="_blank" rel="noopener nofollow" className="flex items-center gap-1.5 text-cyan-700 hover:underline"><Globe className="size-4" />{l.website.replace(/^https?:\/\//, "")}<ExternalLink className="size-3" /></a>}
          {l.legalName && <span className="text-black/40">{l.legalName}</span>}
        </div>
      </div>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${tier.cls}`}><tier.Icon className="size-4" />{tier.label}</span>
    </div>

    <div className={`mt-8 rounded-[24px] border p-6 ${tier.cls}`}>
      <p className="text-sm leading-6">{tier.blurb}</p>
      {l.independence !== "independent" && l.independentNote && <p className="mt-3 text-sm leading-6 opacity-90"><span className="font-semibold">Why: </span>{l.independentNote}</p>}
    </div>

    <div className="mt-6 grid gap-3 sm:grid-cols-4">
      <div className="rounded-[22px] border border-black/[.07] bg-white p-5"><p className="text-[10px] uppercase tracking-wide text-black/35">Certificates on VIAL</p><p className="mt-2 text-2xl font-semibold tabular-nums">{usage.coaCount}</p></div>
      <div className="rounded-[22px] border border-black/[.07] bg-white p-5"><p className="text-[10px] uppercase tracking-wide text-black/35">Vendors tested</p><p className="mt-2 text-2xl font-semibold tabular-nums">{usage.vendorCount}</p></div>
      <div className="rounded-[22px] border border-black/[.07] bg-white p-5"><p className="text-[10px] uppercase tracking-wide text-black/35">Median purity</p><p className="mt-2 text-2xl font-semibold tabular-nums">{usage.purityMedian != null ? `${usage.purityMedian.toFixed(1)}%` : "—"}</p></div>
      <div className="rounded-[22px] border border-black/[.07] bg-white p-5"><p className="text-[10px] uppercase tracking-wide text-black/35">Public verify portal</p><p className="mt-2 text-sm font-semibold">{l.verifyPortal ? <a href={l.verifyPortal} target="_blank" rel="noopener nofollow" className="text-cyan-700 hover:underline">Yes →</a> : "None"}</p></div>
    </div>

    {/* Accreditation — the litigation-sensitive part, stated only with its verification status. */}
    <section className="mt-10 rounded-[26px] border border-black/[.07] bg-[#faf9f6] p-7">
      <h2 className="text-xs font-semibold uppercase tracking-[.16em] text-black/55">Accreditation</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {a.iso17025 === true
          ? <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${a.scopeCoversPeptides === false ? "text-amber-700 bg-amber-50 border-amber-200" : "text-emerald-700 bg-emerald-50 border-emerald-200"}`}>{a.scopeCoversPeptides === false ? <AlertTriangle className="size-3.5" /> : <ShieldCheck className="size-3.5" />}{a.standard}{a.body ? ` · ${a.body}` : ""}{a.number ? ` #${a.number}` : ""}</span>
          : <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-black/55"><ShieldQuestion className="size-3.5" />No accreditation on record</span>}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-black/40">{a.status.replaceAll("-", " ")}</span>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-black/60">{a.note}</p>
    </section>

    <section className="mt-10 grid gap-4 md:grid-cols-2">
      <div className="rounded-[26px] border border-black/[.07] bg-white p-6">
        <h3 className="font-semibold">What it tests</h3>
        <div className="mt-3 flex flex-wrap gap-2">{l.techniques.map((t) => <span key={t} className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">{t}</span>)}</div>
        {l.doesNotTestByDefault.length > 0 && <p className="mt-4 text-xs leading-5 text-black/50"><span className="font-semibold text-black/70">Not covered by a default certificate:</span> {l.doesNotTestByDefault.join(", ")}. A purity certificate does not establish these.</p>}
      </div>
      <div className="rounded-[26px] border border-black/[.07] bg-white p-6">
        <h3 className="font-semibold">Reputation &amp; incidents</h3>
        <p className="mt-3 text-sm leading-6 text-black/60">{l.reputation}</p>
        {l.incidents.map((i) => <p key={i} className="mt-3 flex gap-2 text-xs leading-5 text-amber-800"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{i}</p>)}
      </div>
    </section>

    {vendors.length > 0 && <section className="mt-10">
      <h2 className="text-3xl font-semibold tracking-[-.04em]">Vendors this lab has tested</h2>
      <div className="mt-5 flex flex-wrap gap-2">{vendors.map((v) => <Link key={v.vendorSlug} href={`/vendors/${v.vendorSlug}`} className="inline-flex items-center gap-1.5 rounded-full border border-black/[.08] bg-white px-3 py-1.5 text-sm font-semibold hover:border-cyan-300">{v.vendorSlug} <span className="text-black/40">{v.coas}</span></Link>)}</div>
    </section>}

    {recentTests.length > 0 && <section className="mt-10">
      <h2 className="text-3xl font-semibold tracking-[-.04em]">Recent certificates</h2>
      <div className="mt-5 overflow-x-auto rounded-[24px] border border-black/[.07] bg-white"><table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-black/[.025] text-[10px] uppercase tracking-[.12em] text-black/40"><tr><th className="px-5 py-3 font-medium">Sample</th><th className="px-5 py-3 font-medium">Vendor</th><th className="px-5 py-3 font-medium">Purity</th><th className="px-5 py-3 font-medium"></th><th className="px-5 py-3 font-medium"></th></tr></thead>
        <tbody className="divide-y divide-black/[.06]">{recentTests.map((t, i) => <tr key={i}>
          <td className="px-5 py-3 text-xs">{t.sampleName.slice(0, 46)}</td>
          <td className="px-5 py-3 text-xs">{t.vendorSlug ? <Link href={`/vendors/${t.vendorSlug}`} className="text-cyan-700 hover:underline">{t.vendorSlug}</Link> : "—"}</td>
          <td className="px-5 py-3">{t.purityPct != null ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 tabular-nums">{t.purityPct.toFixed(2)}%</span> : <span className="text-xs text-black/40">See report</span>}</td>
          <td className="px-5 py-3">{t.isBlind && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800"><EyeOff className="size-3" />Blind</span>}</td>
          <td className="px-5 py-3"><a href={t.verifyUrl} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline"><FlaskConical className="size-3" />View</a></td>
        </tr>)}</tbody>
      </table></div>
    </section>}

    <section className="mt-10 rounded-[26px] bg-[#111214] p-7 text-white">
      <h2 className="text-lg font-semibold">Sources</h2>
      <p className="mt-2 text-xs leading-5 text-white/50">Everything on this page is drawn from public records. Naming a lab is never an endorsement, and an accreditation is only as good as the specific method scope it covers.</p>
      <div className="mt-4 flex flex-wrap gap-2">{l.sourceUrls.map((u) => <a key={u} href={u} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/20">{new URL(u).hostname.replace(/^www\./, "")} <ExternalLink className="size-3" /></a>)}</div>
    </section>
  </div>;
}
