import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Check, CircleAlert, CircleDashed, Database, Fingerprint, Scale, ShieldCheck } from "lucide-react";
import { ArtCoa, ArtShieldCheck, VialBuddy } from "@/components/vial-art";

export const metadata: Metadata = {
  title: "How we check",
  description: "How VialGrade decides what counts as proof: lab reports, batch matching, who picked the sample, and what we refuse to guess about.",
};

const ladder = [
  { code: "D0", title: "We found a document", detail: "A lab report or vendor page exists and we saved a copy. That's all it proves so far — anyone can post a PDF." },
  { code: "D1", title: "The lab confirms it's theirs", detail: "The laboratory named on the report confirms it really issued it. The paper is genuine — this is where a QR-verifiable COA gets you." },
  { code: "S1", title: "Tested — but the vendor picked the sample", detail: "A real sample was tested, but the vendor chose which vial went to the lab. A cherry-picked winner proves less than it looks like." },
  { code: "S2", title: "Tested from a customer's sealed unit", detail: "A customer sent in a sealed unit with documented handling. Harder to game — this is what actually shipped." },
  { code: "S3", title: "Tested from a blind purchase", detail: "Someone independent bought the product like any customer would and sent it for testing. The vendor never saw it coming." },
  { code: "S4", title: "Tested repeatedly, from separate sources", detail: "Multiple units of the same batch, bought separately, came back consistent. The strongest evidence we track." },
];

const reportQuestions = [
  { title: "Is the report real?", detail: "Was it genuinely issued by the lab whose name is on it?" },
  { title: "Is it for this batch?", detail: "Does the report's batch number match the batch actually being sold?" },
  { title: "Is it the right compound?", detail: "Did the tested sample match what the label claims it is?" },
  { title: "Is the dose really there?", detail: "Was the amount measured independently, or just printed on the label?" },
  { title: "Who picked the sample?", detail: "A vendor-picked sample and a blind purchase are very different proof." },
  { title: "Is it clean?", detail: "Were sterility, endotoxin, or particulates separately checked? Usually they weren't — we say so." },
];

export default function HowWeCheckPage() {
  return (
    <>
      {/* Signature: near-black — the credibility backbone, under the hood. */}
      <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-[#111214] text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <ArtCoa className="gum-float absolute right-[6%] top-[16%] hidden w-24 sm:block lg:w-28" />
          <ArtShieldCheck className="gum-float-slow absolute right-[16%] bottom-[14%] hidden w-20 lg:block" />
          <VialBuddy className="gum-float-rev absolute right-[26%] top-[22%] hidden w-14 lg:block" liquid="#8fffd6" cap="#8fffd6" />
        </div>
        <div className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 sm:py-28">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#8fffd6]">How we check</p>
          <h1 className="mt-5 max-w-4xl text-balance text-[clamp(2.8rem,7vw,5.5rem)] font-extrabold leading-[.9] tracking-[-.05em]">Trust is a chain of evidence, <span className="text-[#8fffd6]">not a green check.</span></h1>
          <p className="mt-7 max-w-2xl text-lg font-medium leading-8 text-white/70">
            Before you spend money on a peptide, you want three answers: is it real, will I get scammed, and is this the fair price. This page shows exactly how VialGrade earns each answer — and what we refuse to guess about.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-4 md:grid-cols-3">
          <Principle icon={Database} title="We keep the receipts" detail="A saved, timestamped copy of what every vendor and lab actually showed — so history can't be quietly rewritten." />
          <Principle icon={CircleDashed} title="We don't hide what's missing" detail="No sterility test? We say so, instead of quietly rounding it up to “trusted.” Unknown always stays visible." />
          <Principle icon={ShieldCheck} title="A human checks the big claims" detail="Software gathers the data. Before a scam flag, legal note, or accusation goes public, a person reviews it." />
        </div>
      </section>

      <section className="border-y-2 border-[#111214] bg-white">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">The evidence ladder</p>
              <h2 className="mt-3 text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[.98] tracking-[-.045em]">How much a lab test really proves</h2>
              <p className="mt-4 text-sm font-medium leading-6 text-[var(--muted)]">
                &ldquo;Lab tested&rdquo; can mean six very different things. Every listing on VialGrade is labeled with where it sits on this ladder. Higher doesn&rsquo;t mean &ldquo;safe&rdquo; — it means stronger proof of a narrower fact.
              </p>
            </div>
            <div className="space-y-3">
              {ladder.map((item, index) => (
                <div key={item.code} className="ink-1 hard relative grid gap-4 rounded-[18px] bg-white p-5 sm:grid-cols-[64px_1fr]">
                  <span className="ink grid size-14 place-items-center rounded-2xl bg-[#111214] font-mono text-sm font-extrabold text-white">{item.code}</span>
                  <div>
                    <h3 className="text-lg font-extrabold tracking-[-.025em]">{item.title}</h3>
                    <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{item.detail}</p>
                  </div>
                  {index < ladder.length - 1 && <ArrowDown className="absolute -bottom-[14px] left-[36px] z-10 size-5 rounded-full border-2 border-[#111214] bg-white p-0.5 text-[#111214]" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Reading a lab report</p>
          <h2 className="mt-3 text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[.95] tracking-[-.045em]">One report answers six separate questions</h2>
          <p className="mt-5 text-base font-medium leading-7 text-[var(--muted)]">A polished-looking COA can still dodge most of these. On every listing, VialGrade answers each one separately — established, partial, or unknown.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reportQuestions.map((q) => (
            <div key={q.title} className="ink-1 hard rounded-[18px] bg-white p-6">
              <h3 className="text-lg font-extrabold tracking-[-.025em]">{q.title}</h3>
              <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{q.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="limitations" className="border-y-2 border-[#111214] bg-white">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Limitations by design</p>
            <h2 className="mt-3 text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[.95] tracking-[-.045em]">What we refuse to imply</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Principle icon={CircleDashed} title="No single safety score" detail="Identity, dose, purity, sterility, and legality are different questions. One number would hide whichever answer is missing." />
            <Principle icon={CircleAlert} title="A real COA isn't a guarantee" detail="A genuine report proves the document is genuine. It can't prove the vial in your hand matches the tested sample." />
            <Principle icon={Scale} title="No legal shortcuts" detail="Regulatory information is dated, jurisdiction-specific, and reviewed before it's published." />
            <Principle icon={Fingerprint} title="No anonymous accusations" detail="A scam flag needs a visible evidence trail, a confidence level, and a way for the accused to dispute it." />
          </div>
        </div>
      </section>

      <section id="governance" className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Governance</p>
            <h2 className="mt-3 text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[.95] tracking-[-.045em]">Software proposes. People publish.</h2>
            <p className="mt-5 max-w-xl text-base font-medium leading-7 text-[var(--muted)]">
              Automation does the repetitive collecting and comparing. It never controls money, permissions, legal conclusions, or what gets published about a vendor.
            </p>
          </div>
          <div className="ink hard rounded-[20px] bg-[#111214] p-6 text-white sm:p-8">
            <GovernanceRow icon={Database} title="Nothing is rewritten" detail="Every published change keeps the original snapshot and timestamp behind it." />
            <GovernanceRow icon={Check} title="Structured before reviewed" detail="Extracted claims must fit typed fields before they can even enter review." />
            <GovernanceRow icon={ShieldCheck} title="High-impact claims wait for a person" detail="Scam flags, legal events, and adverse findings require deterministic rules or human approval." />
          </div>
        </div>
      </section>

      <section className="border-t-2 border-[#111214] bg-white">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-20">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Go deeper</p>
          <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold tracking-[-.04em]">The full records, if you want them</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DeepLink href="/passports" title="Batch passports" detail="The complete test record for a specific batch — including results that disagree." />
            <DeepLink href="/research" title="Lab reports" detail="Every report we've located, what it establishes, and what it doesn't." />
            <DeepLink href="/testing" title="Independent testing" detail="Blind-purchase and sealed-sample programs, and why sample origin matters." />
            <DeepLink href="/labs" title="Laboratories" detail="Who runs the tests, their methods, and their report history." />
          </div>
        </div>
      </section>
    </>
  );
}

function Principle({ icon: Icon, title, detail }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string }) {
  return (
    <div className="ink-1 hard rounded-[18px] bg-white p-6">
      <span className="ink-1 grid size-11 place-items-center rounded-2xl bg-[#eef0ff]"><Icon className="size-4 text-[#2b31d8]" /></span>
      <h3 className="mt-5 text-lg font-extrabold tracking-[-.025em]">{title}</h3>
      <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function GovernanceRow({ icon: Icon, title, detail }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string }) {
  return (
    <div className="flex gap-4 border-b border-white/12 py-5 first:pt-0 last:border-0 last:pb-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10"><Icon className="size-4 text-[#8fffd6]" /></span>
      <div>
        <h3 className="text-sm font-extrabold">{title}</h3>
        <p className="mt-1.5 text-sm font-medium leading-6 text-white/55">{detail}</p>
      </div>
    </div>
  );
}

function DeepLink({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <Link href={href} className="ink-1 hard press group rounded-[18px] bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold tracking-[-.025em]">{title}</h3>
        <ArrowUpRight className="size-4 text-[#111214] transition group-hover:translate-x-0.5" />
      </div>
      <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{detail}</p>
    </Link>
  );
}
