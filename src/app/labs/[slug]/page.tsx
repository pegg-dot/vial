import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, ShieldQuestion, ExternalLink, FlaskConical, EyeOff, MapPin, Globe, AlertTriangle } from "lucide-react";
import { getLabDetail } from "@/server/labs/repository";
import type { LabIndependence } from "@/server/labs/registry";

export const dynamic = "force-dynamic";

const INDEP: Record<LabIndependence, { label: string; cls: string; Icon: typeof ShieldCheck; blurb: string }> = {
  independent: { label: "Confirmed independent lab", cls: "text-[#0e8f80] bg-[#e6fbf4]", Icon: ShieldCheck, blurb: "We confirmed this is a real, third-party laboratory that is independent of the vendors whose products it tests. Its certificates count as independent corroboration." },
  "independence-unverified": { label: "Independence unverified", cls: "text-[#b26a00] bg-[#fff4e0]", Icon: ShieldQuestion, blurb: "This is a real, operating lab, but we could not confirm it is independent of the vendors it serves. We show its certificates for transparency, but they do not count as confirmed independent corroboration." },
  unverified: { label: "Unverified lab", cls: "text-[#d3372c] bg-[#fff1f0]", Icon: ShieldAlert, blurb: "We could not confirm this is a real, independent laboratory. Its certificates are shown for transparency only and never counted as independent evidence." },
};

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getLabDetail(slug);
  if (!data) notFound();
  const { profile: l, usage, vendors, recentTests } = data;
  const tier = INDEP[l.independence];
  const a = l.accreditation;

  return <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-24">
    <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#0e8f80]">Testing laboratory</p>
    <div className="mt-3 flex flex-wrap items-start justify-between gap-6">
      <div>
        <h1 className="text-5xl font-extrabold tracking-[-.065em] sm:text-7xl">{l.displayName}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm font-medium text-[var(--muted)]">
          {l.country && <span className="flex items-center gap-1.5"><MapPin className="size-4" />{l.country}</span>}
          {l.website && <a href={l.website} target="_blank" rel="noopener nofollow" className="flex items-center gap-1.5 text-[#0e8f80] hover:underline"><Globe className="size-4" />{l.website.replace(/^https?:\/\//, "")}<ExternalLink className="size-3" /></a>}
          {l.legalName && <span className="text-[var(--muted)]">{l.legalName}</span>}
        </div>
      </div>
      <span className={`inline-flex items-center gap-1.5 ink-1 rounded-full px-3 py-1.5 text-xs font-bold ${tier.cls}`}><tier.Icon className="size-4" />{tier.label}</span>
    </div>

    <div className={`mt-8 ink-1 hard rounded-[18px] p-6 ${tier.cls}`}>
      <p className="text-sm font-medium leading-6">{tier.blurb}</p>
      {l.independence !== "independent" && l.independentNote && <p className="mt-3 text-sm font-medium leading-6 opacity-90"><span className="font-bold">Why: </span>{l.independentNote}</p>}
    </div>

    <div className="mt-6 grid gap-3 sm:grid-cols-4">
      <div className="ink-1 hard rounded-[18px] bg-white p-5"><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Certificates on VIAL</p><p className="mt-2 text-2xl font-extrabold tabular-nums">{usage.coaCount}</p></div>
      <div className="ink-1 hard rounded-[18px] bg-white p-5"><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Vendors tested</p><p className="mt-2 text-2xl font-extrabold tabular-nums">{usage.vendorCount}</p></div>
      <div className="ink-1 hard rounded-[18px] bg-white p-5"><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Median purity</p><p className="mt-2 text-2xl font-extrabold tabular-nums">{usage.purityMedian != null ? `${usage.purityMedian.toFixed(1)}%` : "—"}</p></div>
      <div className="ink-1 hard rounded-[18px] bg-white p-5"><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Public verify portal</p><p className="mt-2 text-sm font-bold">{l.verifyPortal ? <a href={l.verifyPortal} target="_blank" rel="noopener nofollow" className="text-[#0e8f80] hover:underline">Yes →</a> : "None"}</p></div>
    </div>

    {/* Accreditation — the litigation-sensitive part, stated only with its verification status. */}
    <section className="mt-10 ink-1 hard rounded-[20px] bg-[#faf9f6] p-7">
      <h2 className="text-xs font-extrabold uppercase tracking-[.16em] text-[#0e8f80]">Accreditation</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {a.iso17025 === true
          ? <span className={`inline-flex items-center gap-1.5 ink-1 rounded-full px-3 py-1 text-xs font-bold ${a.scopeCoversPeptides === false ? "text-[#b26a00] bg-[#fff4e0]" : "text-[#0e8f80] bg-[#e6fbf4]"}`}>{a.scopeCoversPeptides === false ? <AlertTriangle className="size-3.5" /> : <ShieldCheck className="size-3.5" />}{a.standard}{a.body ? ` · ${a.body}` : ""}{a.number ? ` #${a.number}` : ""}</span>
          : <span className="inline-flex items-center gap-1.5 ink-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--muted)]"><ShieldQuestion className="size-3.5" />No accreditation on record</span>}
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{a.status.replaceAll("-", " ")}</span>
      </div>
      <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">{a.note}</p>
    </section>

    <section className="mt-10 grid gap-4 md:grid-cols-2">
      <div className="ink-1 hard rounded-[18px] bg-white p-6">
        <h3 className="font-extrabold">What it tests</h3>
        <div className="mt-3 flex flex-wrap gap-2">{l.techniques.map((t) => <span key={t} className="ink-1 rounded-full bg-[#e6fbf4] px-3 py-1 text-xs font-bold text-[#0e8f80]">{t}</span>)}</div>
        {l.doesNotTestByDefault.length > 0 && <p className="mt-4 text-xs font-medium leading-5 text-[var(--muted)]"><span className="font-bold text-[#111214]">Not covered by a default certificate:</span> {l.doesNotTestByDefault.join(", ")}. A purity certificate does not establish these.</p>}
      </div>
      <div className="ink-1 hard rounded-[18px] bg-white p-6">
        <h3 className="font-extrabold">Reputation &amp; incidents</h3>
        <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">{l.reputation}</p>
        {l.incidents.map((i) => <p key={i} className="mt-3 flex gap-2 text-xs font-medium leading-5 text-[#b26a00]"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{i}</p>)}
      </div>
    </section>

    {vendors.length > 0 && <section className="mt-10">
      <h2 className="text-3xl font-extrabold tracking-[-.04em]">Vendors this lab has tested</h2>
      <div className="mt-5 flex flex-wrap gap-2">{vendors.map((v) => <Link key={v.vendorSlug} href={`/vendors/${v.vendorSlug}`} className="ink-1 hard-sm press inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-bold">{v.vendorSlug} <span className="text-[var(--muted)]">{v.coas}</span></Link>)}</div>
    </section>}

    {recentTests.length > 0 && <section className="mt-10">
      <h2 className="text-3xl font-extrabold tracking-[-.04em]">Recent certificates</h2>
      <div className="mt-5 overflow-x-auto ink hard rounded-[20px] bg-white"><table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-[#f7f7f4] text-[10px] uppercase tracking-[.12em] text-[var(--muted)]"><tr><th className="px-5 py-3 font-bold">Sample</th><th className="px-5 py-3 font-bold">Vendor</th><th className="px-5 py-3 font-bold">Purity</th><th className="px-5 py-3 font-bold"></th><th className="px-5 py-3 font-bold"></th></tr></thead>
        <tbody className="divide-y divide-[#111214]/10">{recentTests.map((t, i) => <tr key={i}>
          <td className="px-5 py-3 text-xs">{t.sampleName.slice(0, 46)}</td>
          <td className="px-5 py-3 text-xs">{t.vendorSlug ? <Link href={`/vendors/${t.vendorSlug}`} className="text-[#0e8f80] hover:underline">{t.vendorSlug}</Link> : "—"}</td>
          <td className="px-5 py-3">{t.purityPct != null ? <span className="ink-1 rounded-full bg-[#e6fbf4] px-2.5 py-1 text-xs font-bold text-[#0e8f80] tabular-nums">{t.purityPct.toFixed(2)}%</span> : <span className="text-xs text-[var(--muted)]">See report</span>}</td>
          <td className="px-5 py-3">{t.isBlind && <span className="ink-1 inline-flex items-center gap-1 rounded-full bg-[#f0edff] px-2 py-0.5 text-[10px] font-bold text-[#6d5dfc]"><EyeOff className="size-3" />Blind</span>}</td>
          <td className="px-5 py-3"><a href={t.verifyUrl} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 text-xs font-bold text-[#0e8f80] hover:underline"><FlaskConical className="size-3" />View</a></td>
        </tr>)}</tbody>
      </table></div>
    </section>}

    <section className="mt-10 ink hard rounded-[20px] bg-[#111214] p-7 text-white">
      <h2 className="text-lg font-extrabold">Sources</h2>
      <p className="mt-2 text-xs font-medium leading-5 text-white/70">Everything on this page is drawn from public records. Naming a lab is never an endorsement, and an accreditation is only as good as the specific method scope it covers.</p>
      <div className="mt-4 flex flex-wrap gap-2">{l.sourceUrls.map((u) => <a key={u} href={u} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/20">{new URL(u).hostname.replace(/^www\./, "")} <ExternalLink className="size-3" /></a>)}</div>
    </section>
  </div>;
}
