import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Scale, Pill, FlaskConical, Landmark } from "lucide-react";
import { US_REGULATION_FACTS } from "@/lib/us-legal";

export const metadata: Metadata = {
  title: "How research peptides are regulated in the US",
  description: "A plain-English overview of US law around research peptides — FDA status, what's legal to buy, prescription drugs, import risk, and state law. Informational, not legal advice.",
};

const CATEGORIES = [
  { icon: FlaskConical, tone: "text-[#111214] bg-[var(--background)]", label: "Research-use-only", body: "Most peptides here. Not FDA-approved, sold “for research only.” Generally legal to buy as a research chemical, but not a supplement and not lawful to market or use as a drug." },
  { icon: Pill, tone: "text-[#d3372c] bg-[#fff1f0]", label: "Prescription drugs", body: "Semaglutide, tirzepatide, liraglutide, tesamorelin, sermorelin, gonadorelin, oxytocin. FDA-approved medications — a “research” version bypasses the prescription and the FDA has acted against unapproved copies." },
  { icon: AlertTriangle, tone: "text-[#b26a00] bg-[#fff4e0]", label: "Investigational", body: "Retatrutide, survodutide, mazdutide, cagrilintide. Still in clinical trials, no approval, and under active FDA scrutiny of the GLP-1 “research” market." },
];

export default function Page() {
  return (
    <div className="mx-auto max-w-[960px] px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#2b31d8]">United States · know before you buy</p>
      <h1 className="mt-4 text-5xl font-extrabold tracking-[-.065em] sm:text-7xl">The law around research peptides</h1>
      <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted)]">Most people buying these are in the US, so here’s the regulatory reality in plain English — what these compounds actually are in the eyes of the law, what’s legal to buy, and where the real risk sits.</p>

      <div className="ink-1 mt-8 flex items-start gap-3 rounded-[14px] bg-[#fff4e0] p-4">
        <Scale className="mt-0.5 size-5 shrink-0 text-[#b26a00]" />
        <p className="text-sm leading-6 text-[#111214]/80"><span className="font-semibold">This is general information, not legal or medical advice.</span> VIAL sells nothing, encourages no human use, and is not a law firm. Laws change and vary by state — consult a licensed attorney and physician for your situation.</p>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-extrabold tracking-[-.04em]">Three legal categories</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Not everything on VIAL sits in the same legal bucket. The status on each compound page tells you which one it’s in.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="ink hard rounded-[18px] bg-white p-5">
                <span className={`ink-1 inline-flex size-9 items-center justify-center rounded-[10px] ${c.tone}`}><Icon className="size-4" /></span>
                <p className="mt-4 font-extrabold tracking-[-.02em]">{c.label}</p>
                <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">{c.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-14">
        <div className="flex items-center gap-2.5">
          <Landmark className="size-5 text-[#2b31d8]" />
          <h2 className="text-2xl font-extrabold tracking-[-.04em]">The details</h2>
        </div>
        <div className="ink hard mt-6 divide-y divide-[#111214]/10 rounded-[20px] bg-white px-6 sm:px-9">
          {US_REGULATION_FACTS.map(({ title, body }) => (
            <section key={title} className="py-7">
              <h3 className="text-lg font-extrabold tracking-[-.03em]">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{body}</p>
            </section>
          ))}
        </div>
      </section>

      <p className="mt-10 text-sm leading-7 text-[var(--muted)]">The bottom line: buying most research peptides in the US isn’t itself a crime, but nothing here is FDA-approved, tested for human safety, or sold as fit to use — and the prescription drugs and investigational agonists carry sharply higher legal exposure. VIAL exists to make that reality legible, not to tell you what to do with it.</p>

      <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold text-[#2b31d8]">
        <Link href="/legal/disclaimer">Research & medical disclaimer</Link>
        <Link href="/legal/terms">Terms</Link>
        <Link href="/how-we-check">How we check</Link>
      </div>
    </div>
  );
}
