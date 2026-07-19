import type { Metadata } from "next";
import { ArrowDown, Check, CircleAlert, CircleDashed, Database, Fingerprint, Scale, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Evidence methodology",
  description: "How VIAL separates vendor records, documents, sample provenance, and physical-product evidence.",
};

const ladder = [
  { code: "D0", title: "Document located", detail: "A public file or vendor page was captured and preserved. Authenticity is not yet established." },
  { code: "D1", title: "Issuer confirmed", detail: "The named laboratory or source confirmed the report identifier or document record." },
  { code: "S1", title: "Vendor-selected sample", detail: "A physical sample was tested, but the vendor controlled which unit reached the laboratory." },
  { code: "S2", title: "Customer-submitted sample", detail: "A sealed sample was submitted by a customer with documented intake and chain of custody." },
  { code: "S3", title: "Independent purchase", detail: "The platform or a trusted third party obtained the sample without vendor control." },
  { code: "S4", title: "Repeated batch sampling", detail: "Multiple independently sourced units from the same declared batch produced consistent results." },
];

export default function MethodologyPage() {
  return (
    <>
      <section className="border-b border-black/[.06]">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Methodology</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-[.94] tracking-[-.065em] sm:text-7xl">Trust is a chain of evidence, not a green check.</h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
            VIAL separates four questions that are often collapsed together: who the seller is, whether a document is genuine, what a method found in a physical sample, and how confidently that sample represents inventory.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Evidence ladder</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-.05em]">How confidence increases</h2>
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              Higher levels do not mean “safe.” They mean the platform has stronger evidence about a narrower factual claim.
            </p>
          </div>
          <div className="space-y-3">
            {ladder.map((item, index) => (
              <div key={item.code} className="relative grid gap-4 rounded-[24px] border border-black/[.07] bg-white p-5 sm:grid-cols-[64px_1fr]">
                <span className="grid size-14 place-items-center rounded-2xl bg-[#111214] font-mono text-sm font-semibold text-white">{item.code}</span>
                <div>
                  <h3 className="text-lg font-semibold tracking-[-.025em]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>
                </div>
                {index < ladder.length - 1 && <ArrowDown className="absolute -bottom-[13px] left-[38px] z-10 size-4 rounded-full bg-[var(--background)] p-0.5 text-black/35 sm:left-[38px]" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="limitations" className="border-y border-black/[.06] bg-white/60">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Limitations by design</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-.05em] sm:text-5xl">What the platform refuses to imply</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Principle icon={CircleDashed} title="No single safety score" detail="Identity, quantity, impurity, sterility, endotoxin, sampling, and legal status remain separate dimensions." />
            <Principle icon={CircleAlert} title="No paper-to-vial leap" detail="A genuine COA proves that a document is genuine. It does not prove that a buyer’s vial matches the tested sample." />
            <Principle icon={Scale} title="No legal status shortcuts" detail="Regulatory information is dated, jurisdiction-specific, and reviewed before publication." />
            <Principle icon={Fingerprint} title="No anonymous accusations" detail="Entity links and adverse findings require a visible evidence trail, confidence level, and dispute process." />
          </div>
        </div>
      </section>

      <section id="governance" className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Governance</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-.05em] sm:text-5xl">Agents propose. Rules and people publish.</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--muted)]">
              Automation handles repetitive collection and comparison. It does not control money, permissions, legal conclusions, or high-impact publication decisions.
            </p>
          </div>
          <div className="rounded-[28px] bg-[#111214] p-6 text-white sm:p-8">
            <GovernanceRow icon={Database} title="Immutable source record" detail="Every factual change retains the underlying snapshot and timestamp." />
            <GovernanceRow icon={Check} title="Schema validation" detail="Agent output must conform to typed fields before it can enter review." />
            <GovernanceRow icon={ShieldCheck} title="Policy gate" detail="Claims, legal events, adverse findings, and checkout states require deterministic rules or human approval." />
          </div>
        </div>
      </section>
    </>
  );
}

function Principle({ icon: Icon, title, detail }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-black/[.07] bg-white p-6">
      <span className="grid size-11 place-items-center rounded-2xl bg-black/[.05]"><Icon className="size-4" /></span>
      <h3 className="mt-5 text-lg font-semibold tracking-[-.025em]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function GovernanceRow({ icon: Icon, title, detail }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string }) {
  return (
    <div className="flex gap-4 border-b border-white/10 py-5 first:pt-0 last:border-0 last:pb-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10"><Icon className="size-4" /></span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-white/50">{detail}</p>
      </div>
    </div>
  );
}
