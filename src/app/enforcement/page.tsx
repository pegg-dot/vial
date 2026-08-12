import type { Metadata } from "next";
import Link from "next/link";
import { Gavel, ExternalLink, ShieldAlert, Landmark, Scale } from "lucide-react";
import { listRegulatoryActions, getRegulatoryStats } from "@/server/regulatory/repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Enforcement record", description: "Public FDA, DOJ, and FTC actions against peptide and research-chemical sellers — sourced, factual, never our accusation." };

const AGENCY: Record<string, string> = { FDA: "FDA", DOJ: "U.S. DOJ", FTC: "FTC", state: "State", other: "Regulator" };
const TYPE: Record<string, string> = { warning_letter: "Warning letter", import_alert: "Import alert", doj_action: "Enforcement action", ftc_action: "FTC action", recall: "Recall", advisory: "Advisory" };

export default async function Page() {
  const [actions, stats] = await Promise.all([listRegulatoryActions(), getRegulatoryStats()]);
  return <div>
    <section className="border-b-2 border-[#111214]"><div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#d3372c]">Enforcement record</p>
      <h1 className="mt-4 max-w-5xl text-5xl font-extrabold tracking-[-.065em] sm:text-7xl">The government paper trail.</h1>
      <p className="mt-6 max-w-3xl text-base font-medium leading-7 text-[var(--muted)]">Public FDA warning letters and import alerts, DOJ prosecutions, FTC actions, and recalls affecting peptide and research-chemical sellers. Every entry is a real government record with its source linked. We report the action &mdash; we never add an accusation of our own, and a match to a specific vendor is only made when we&rsquo;re confident.</p>
      <div className="mt-10 grid gap-3 sm:grid-cols-4">
        <Stat icon={Gavel} value={stats.total} label="Actions on record" />
        <Stat icon={ShieldAlert} value={stats.severe} label="Severe (proven)" />
        <Stat icon={Landmark} value={stats.vendorsAffected} label="Tracked vendors affected" />
        <Stat icon={Scale} value={stats.agencies} label="Agencies" />
      </div>
    </div></section>
    <section className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
      <div className="space-y-3">{actions.map((a) => {
        const severe = a.severity === "severe";
        return <div key={a.id} className={`ink-1 hard rounded-[18px] p-6 ${severe ? "bg-[#ffecea]" : "bg-white"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{AGENCY[a.agency] ?? a.agency} · {TYPE[a.action_type] ?? a.action_type}{a.outcome ? ` · ${a.outcome.replaceAll("_", " ")}` : ""}{a.action_date ? ` · ${a.action_date}` : ""}</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-.02em]">{a.title}</h2>
              <p className="mt-1 text-sm font-medium text-[var(--muted)]">Named: <span className="font-bold text-[#111214]">{a.subject_name}</span>{a.vendor_name ? <> · matched to <Link href={`/vendors/${a.vendor_slug}`} className="font-bold text-[#d3372c] hover:underline">{a.vendor_name}</Link></> : <span className="text-[var(--muted)]"> · not matched to a tracked vendor</span>}</p>
              <p className="mt-2 text-sm font-medium leading-6 text-[#111214]/70">{a.summary}</p>
            </div>
            <span className={`ink-1 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase text-white ${severe ? "bg-[#d3372c]" : a.severity === "caution" ? "bg-[#b26a00]" : "bg-black/40"}`}>{a.severity}</span>
          </div>
          <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#d3372c] underline underline-offset-2">Read the official record <ExternalLink className="size-3" /></a>
        </div>;
      })}</div>
      {actions.length === 0 && <p className="text-sm font-medium text-[var(--muted)]">No enforcement records ingested yet.</p>}
      <div className="ink mt-10 rounded-[20px] bg-[#111214] p-7 text-white shadow-[5px_5px_0_0_#d3372c]"><Scale className="size-5 text-[#ff9b8f]" />
        <h2 className="mt-5 text-2xl font-extrabold">A record is a fact, not a verdict on the product.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">An FDA warning letter usually means a seller marketed unapproved drugs &mdash; it doesn&rsquo;t always mean the specific product you&rsquo;re looking at is impure. We show the record and the source so you can judge; we distinguish a proven criminal outcome from a mere charge, and a warning letter from a conviction. We never infer guilt VialGrade cannot source.</p>
      </div>
    </section>
  </div>;
}
function Stat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string }) { return <div className="ink-1 hard rounded-[18px] bg-white p-5"><Icon className="size-4 text-[#d3372c]" /><p className="mt-5 text-3xl font-extrabold tracking-[-.055em] tabular-nums">{value}</p><p className="mt-1 text-xs text-[var(--muted)]">{label}</p></div>; }
