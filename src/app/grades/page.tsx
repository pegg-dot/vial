import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, CircleAlert, CircleDashed, ExternalLink, FileText, FlaskConical, Landmark, ScrollText, Scale, ShieldQuestion } from "lucide-react";
import { ArtCoa, ArtShieldCheck, VialBuddy } from "@/components/vial-art";
import { PURITY_IS_NOT_GRADE } from "@/lib/provenance-copy";

export const metadata: Metadata = {
  title: "Purity vs grade",
  description: "“99% pure” and “pharmaceutical grade” are two different claims, and vendors blur them on purpose. What research-use-only, pharmaceutical grade, and GMP actually mean — and the one question that tells you which you are being sold.",
};

// Everything on this page that states a rule was read off a primary source and is listed in SOURCES
// below. The date is shown to the reader because the compounding rules in particular move: the FDA
// advisory committee met on this exact subject three weeks before this page was written.
const CHECKED_ON = "14 August 2026";

// The three words a buyer meets, in the order they escalate. Each one gets the same treatment:
// what it actually is, what it is NOT, and the thing you can say out loud to test it.
const LAYERS = [
  {
    eyebrow: "Layer 1",
    name: "“Research use only”",
    kicker: "A sentence about intended use. Not a quality tier.",
    icon: FlaskConical,
    tint: "bg-[#f0f0ec] text-[#61636B]",
    is: "A line the seller prints on the label saying the contents are not meant for people. That is the whole of it.",
    isNot: "A grade. There is no purity bar a product has to clear to be called “research use only,” no inspection behind it, and no one checking. Two vials with the same disclaimer can be nothing alike.",
    tell: "Ask what standard it was made to, and who verified that. There is no standard behind the phrase, and a candid vendor will tell you so. The label is also not a shield: the FDA has told peptide sellers in writing that a “research use only” statement did not change what their products were — the letter is in the sources below.",
    here: "Essentially every listing on VialGrade sits here.",
  },
  {
    eyebrow: "Layer 2",
    name: "“Pharmaceutical grade”",
    kicker: "A marketing phrase, unless a certificate is attached.",
    icon: ScrollText,
    tint: "bg-[#fff4e0] text-[#b26a00]",
    is: "A phrase with real pull and no fixed meaning of its own. The terms that carry weight in US drug law are specific and nameable: meeting a USP or NF monograph, being made in a facility registered with the FDA, and being made under GMP.",
    isNot: "It is not a classification anyone assigns or certifies. You can check this yourself in about a minute: the phrase appears nowhere in Title 21 of the Code of Federal Regulations, the part of US law that covers food and drugs. Search the entire CFR for it and you get 14 results — every one of them in the EPA’s air-pollution rules.",
    tell: "Ask which of the three they mean, and ask for the paperwork. A vendor who means something specific will name it. A vendor who means nothing will answer with a purity number — which is the other question entirely.",
    here: "Watch for it in the fine print near a big purity figure.",
  },
  {
    eyebrow: "Layer 3",
    name: "GMP",
    kicker: "A real standard about the building, not the batch.",
    icon: Building2,
    tint: "bg-[#e6fbf4] text-[#0e8f80]",
    is: "Good Manufacturing Practice — federal regulations covering the methods, facilities and controls used to make a drug. In plain terms: the rooms, the equipment, the staff, the incoming materials, the records, and who is allowed to sign off.",
    isNot: "Not something a lab report can establish. A certificate looks at a sample after the fact; GMP is about what happened in the building before the sample existed.",
    tell: "Ask for the certificate and the name of the body that issued it, and ask whether it covers the finished vial or a raw ingredient bought from someone else. Those are very different claims.",
    here: "Vanishingly rare in this market. Treat a bare “GMP” badge with no document as decoration.",
  },
];

// The actionable half. A buyer cannot audit a factory — but they can ask a question and read the
// shape of the answer. Good answers are specific and checkable, including when the answer is "no".
const ASKS = [
  {
    q: "“Is this GMP? Can I see the certificate and who issued it?”",
    good: "A certificate naming a facility and an issuing body — or a straight “no, this is research material and we don’t claim GMP.” A clean no is a good answer. It is honest and it is checkable.",
    dodge: "“Our purity meets pharmaceutical standards.” That answers a different question. Also watch for “our supplier is GMP” — which supplier, for which step, and does it cover the vial you would receive?",
  },
  {
    q: "“Who picked the vial that was tested?”",
    good: "A sealed retail unit sent in, or a third-party blind purchase. The vendor did not choose which one went to the lab.",
    dodge: "“We test every batch,” with no word on where the sample came from. A vendor-chosen sample is the vendor’s best vial, and you are not buying that vial.",
  },
  {
    q: "“What batch number is that certificate for, and is it the batch I’d receive?”",
    good: "A batch number you can match to the label on the vial that arrives.",
    dodge: "One undated certificate reused across every product, or a batch number that appears nowhere on what ships.",
  },
  {
    q: "“Was anything besides purity tested?”",
    good: "Naming what was tested and what wasn’t — sterility and endotoxin are separate tests and usually were not run.",
    dodge: "Answering with the purity number again, as though clean and pure were the same word.",
  },
  {
    q: "“Which lab, and can they confirm they issued this?”",
    good: "A named lab with a way to verify the report independently.",
    dodge: "A PDF with a logo and no route back to the lab. Anyone can make one of those.",
  },
];

const SOURCES = [
  {
    title: "Current Good Manufacturing Practice regulations — 21 CFR Part 210",
    publisher: "Electronic Code of Federal Regulations",
    url: "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-C/part-210",
    supports: "GMP is defined as the minimum practice for the methods, facilities and controls used to make a drug — not as a property of a finished sample.",
  },
  {
    title: "CGMP for finished pharmaceuticals — 21 CFR Part 211",
    publisher: "Electronic Code of Federal Regulations",
    url: "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-C/part-211",
    supports: "What GMP actually covers, subpart by subpart: personnel, buildings and facilities, equipment, incoming components, production controls, packaging, holding, laboratory controls, and records.",
  },
  {
    title: "Full-text search of the Code of Federal Regulations for “pharmaceutical grade”",
    publisher: "Electronic Code of Federal Regulations (search API)",
    url: "https://www.ecfr.gov/api/search/v1/counts/hierarchy?query=%22pharmaceutical+grade%22",
    supports: "That the phrase appears nowhere in Title 21 (Food and Drugs). It returns 14 results across the whole CFR, all of them under Title 40, the EPA’s air programs.",
  },
  {
    title: "Bulk Drug Substances Used in Compounding Under Section 503A of the FD&C Act",
    publisher: "U.S. Food and Drug Administration (page current as of 14 May 2026)",
    url: "https://www.fda.gov/drugs/human-drug-compounding/bulk-drug-substances-used-compounding-under-section-503a-fdc-act",
    supports: "What a compounding pharmacy may use, the requirement for both a valid certificate of analysis and an FDA-registered manufacturing establishment, and the definition of category 2.",
  },
  {
    title: "Certain Bulk Drug Substances for Use in Compounding that May Present Significant Safety Risks",
    publisher: "U.S. Food and Drug Administration (page current as of 22 April 2026)",
    url: "https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks",
    supports: "The category 2 table and its dates, and the separate table of substances previously in category 2 that were withdrawn by their nominators.",
  },
  {
    title: "Meeting of the Pharmacy Compounding Advisory Committee, 23–24 July 2026",
    publisher: "U.S. Food and Drug Administration",
    url: "https://www.fda.gov/advisory-committees/advisory-committee-calendar/july-23-24-2026-meeting-pharmacy-compounding-advisory-committee-07232026",
    supports: "The agenda naming BPC-157, KPV, TB-500, MOTS-c, emideltide (DSIP), semax and epitalon as substances being considered for the 503A bulks list.",
  },
  {
    title: "Compounding and the FDA: Questions and Answers",
    publisher: "U.S. Food and Drug Administration (page current as of 16 September 2025)",
    url: "https://www.fda.gov/drugs/human-drug-compounding/compounding-and-fda-questions-and-answers",
    supports: "The difference between 503A pharmacies and 503B outsourcing facilities, who inspects each, and which of the two is subject to CGMP.",
  },
  {
    title: "Warning letter to Gram Peptides, 31 March 2026 (MARCS-CMS 721806)",
    publisher: "U.S. Food and Drug Administration",
    url: "https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/gram-peptides-721806-03312026",
    supports: "The FDA stating that a “Research Use Only” label did not change what the products were, where the seller’s own marketing showed they were intended as drugs for people. The FDA cautions that a warning letter reflects the situation at the time it was issued and the status may have changed since — check the letter for a closeout.",
  },
  {
    title: "Drug Establishments Current Registration Site (DECRS)",
    publisher: "U.S. Food and Drug Administration",
    url: "https://www.fda.gov/drugs/drug-approvals-and-databases/drug-establishments-current-registration-site-decrs",
    supports: "The public, daily-updated register of drug establishments — where anyone can check whether a named facility is registered with the FDA. The FDA notes on the same page that this register does not include compounding outsourcing facilities, which is why the next source exists.",
  },
  {
    title: "Registered Outsourcing Facilities",
    publisher: "U.S. Food and Drug Administration (list updated 10 August 2026)",
    url: "https://www.fda.gov/drugs/human-drug-compounding/registered-outsourcing-facilities",
    supports: "The separate list of 503B facilities, with each one’s last inspection date, whether a Form 483 was issued, and whether a recall was conducted — including the many rows reading “Not yet inspected.”",
  },
  {
    title: "False Claims of Accreditation",
    publisher: "A2LA (accreditation body for testing laboratories)",
    url: "https://portal.a2la.org/search/falseclaims.cfm",
    supports: "A published, dated list of companies claiming A2LA accreditation without holding it — including a product whose promoted test report used the A2LA symbol without authorization.",
  },
];

export default function GradesPage() {
  return (
    <>
      {/* Signature: near-black with the consumer royal-blue at its light-on-dark weight. */}
      <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-[#111214] text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <ArtCoa className="gum-float absolute right-[7%] top-[18%] hidden w-24 sm:block lg:w-28" />
          <ArtShieldCheck className="gum-float-slow absolute right-[18%] bottom-[12%] hidden w-20 lg:block" />
          <VialBuddy className="gum-float-rev absolute right-[27%] top-[24%] hidden w-14 lg:block" liquid="#8fa2ff" cap="#8fa2ff" />
        </div>
        <div className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 sm:py-28">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#8fa2ff]">Purity vs grade</p>
          <h1 className="mt-5 max-w-4xl text-balance text-[clamp(2.6rem,7vw,5.5rem)] font-extrabold leading-[.9] tracking-[-.05em]">
            &ldquo;99.4% pure&rdquo; is not <span className="text-[#8fa2ff]">a grade.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg font-medium leading-8 text-white/70">
            A purity number and a manufacturing standard are two different claims. Vendors let you hear them as one, because that gap is where this market does its selling. Here is the difference in plain English, and the one question that settles it.
          </p>
        </div>
      </section>

      {/* ── The split, stated once, big ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="ink hard rounded-[20px] bg-white p-6 sm:p-8">
            <span className="ink-1 inline-flex items-center gap-1.5 rounded-full bg-[#eef0ff] px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-[#2b31d8]"><FileText className="size-3" /> Purity</span>
            <h2 className="mt-5 text-[clamp(1.5rem,3.4vw,2.1rem)] font-extrabold leading-[1.02] tracking-[-.04em]">What is in the vial</h2>
            <p className="mt-4 text-sm font-medium leading-6 text-[var(--muted)]">
              One lab took one sample, once, and measured how much of it was the peptide. That is the entire claim. It is a photograph of a sample, and the sample is not the batch.
            </p>
          </div>
          <div className="ink hard rounded-[20px] bg-white p-6 sm:p-8">
            <span className="ink-1 inline-flex items-center gap-1.5 rounded-full bg-[#e6fbf4] px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-[#0e8f80]"><Building2 className="size-3" /> Grade</span>
            <h2 className="mt-5 text-[clamp(1.5rem,3.4vw,2.1rem)] font-extrabold leading-[1.02] tracking-[-.04em]">How it was made</h2>
            <p className="mt-4 text-sm font-medium leading-6 text-[var(--muted)]">
              The room. The equipment and when it was last calibrated. Who was trained, and on what. What was cleaned between batches. Which records exist, and who signed them. A certificate cannot see any of it.
            </p>
          </div>
        </div>

        <div className="ink hard-blue mt-4 rounded-[20px] bg-[#111214] p-6 text-white sm:p-8">
          <p className="text-[clamp(1.05rem,2.2vw,1.35rem)] font-extrabold leading-[1.45] tracking-[-.02em]">{PURITY_IS_NOT_GRADE}</p>
          <p className="mt-5 max-w-3xl text-sm font-medium leading-7 text-white/55">
            The two do not move together. A very high number can come out of an uncontrolled room. A controlled facility can report an ordinary one. So when a number is offered as the answer to &ldquo;is this well made,&rdquo; the question has been quietly swapped.
          </p>
        </div>
      </section>

      {/* ── The three words ─────────────────────────────────────────────────────────── */}
      <section className="border-y-2 border-[#111214] bg-white">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">The three words</p>
            <h2 className="mt-3 text-[clamp(2rem,5vw,3.6rem)] font-extrabold leading-[.95] tracking-[-.045em]">Only one of them means anything on its own</h2>
            <p className="mt-5 text-base font-medium leading-7 text-[var(--muted)]">
              These three get used as if they were rungs on one ladder. They are not. Two are descriptions of intent, and one is a regulation about a building.
            </p>
          </div>
          <div className="mt-10 space-y-4">
            {LAYERS.map((layer) => {
              const Icon = layer.icon;
              return (
                <div key={layer.name} className="ink hard rounded-[20px] bg-white p-6 sm:p-8">
                  <div className="grid gap-6 lg:grid-cols-[.62fr_1.38fr]">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className={`ink-1 grid size-11 shrink-0 place-items-center rounded-2xl ${layer.tint}`}><Icon className="size-4" /></span>
                        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">{layer.eyebrow}</p>
                      </div>
                      <h3 className="mt-4 text-[clamp(1.35rem,3vw,1.9rem)] font-extrabold leading-[1.05] tracking-[-.035em]">{layer.name}</h3>
                      <p className="mt-3 text-sm font-bold leading-6 text-[#2b31d8]">{layer.kicker}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Fact label="What it is" text={layer.is} />
                      <Fact label="What it is not" text={layer.isNot} tone="warn" />
                      <Fact label="How to test it" text={layer.tell} />
                      <Fact label="Where you meet it" text={layer.here} tone="muted" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Compounding: a different lane entirely ──────────────────────────────────── */}
      <section className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Compounded is a fourth thing</p>
          <h2 className="mt-3 text-[clamp(2rem,5vw,3.6rem)] font-extrabold leading-[.95] tracking-[-.045em]">A pharmacy is not a website</h2>
          <p className="mt-5 text-base font-medium leading-7 text-[var(--muted)]">
            If you have seen a clinic or telehealth service offer a peptide, that is compounding — a licensed pharmacy making a drug for a named patient. It is a separate legal lane from a site that ships a vial to anyone. It is worth understanding, because the vendor language borrows from it.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="ink hard rounded-[20px] bg-white p-6 sm:p-7">
            <span className="ink-1 inline-flex items-center gap-1.5 rounded-full bg-[#eef0ff] px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-[#2b31d8]"><Landmark className="size-3" /> 503A</span>
            <h3 className="mt-5 text-xl font-extrabold tracking-[-.03em]">A state-licensed pharmacy</h3>
            <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">
              Day-to-day oversight sits mainly with state boards of pharmacy. The FDA says plainly that drugs compounded this way are <span className="font-bold text-[#111214]">not</span> subject to GMP requirements.
            </p>
          </div>
          <div className="ink hard rounded-[20px] bg-white p-6 sm:p-7">
            <span className="ink-1 inline-flex items-center gap-1.5 rounded-full bg-[#e6fbf4] px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-[#0e8f80]"><Landmark className="size-3" /> 503B</span>
            <h3 className="mt-5 text-xl font-extrabold tracking-[-.03em]">An outsourcing facility</h3>
            <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">
              A category created in 2013. These register with the FDA, are inspected by the FDA on a risk-based schedule, and <span className="font-bold text-[#111214]">are</span> subject to GMP. This is the stricter of the two.
            </p>
          </div>
        </div>

        <div className="ink hard mt-4 rounded-[20px] bg-[#eef0ff] p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="ink-1 mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white"><Scale className="size-4 text-[#2b31d8]" /></span>
            <div className="min-w-0">
              <h3 className="text-xl font-extrabold tracking-[-.03em]">The line the FDA draws, which is this whole page in one rule</h3>
              <p className="mt-3 text-sm font-medium leading-7 text-[#111214]/75">
                For a pharmacy to compound with a bulk substance, the FDA requires two separate things: a valid certificate of analysis, <span className="font-bold">and</span> that the substance was made by an establishment registered with the FDA. The paper is not accepted in place of the facility. That is the same distinction a vendor collapses when a purity number is offered as proof of quality.
              </p>
            </div>
          </div>
        </div>

        <div className="ink hard mt-4 rounded-[20px] bg-white p-6 sm:p-8">
          <h3 className="text-xl font-extrabold tracking-[-.03em]">Where the well-known peptides actually stand</h3>
          <p className="mt-3 text-sm font-medium leading-7 text-[var(--muted)]">
            The FDA keeps a public list of bulk substances it has flagged as possibly presenting significant safety risks in compounding &mdash; &ldquo;category 2.&rdquo; On 29 September 2023 it added several peptide substances, including GHRP-2, GHRP-6, ipamorelin acetate and kisspeptin-10. For a substance in category 2, the FDA says it would consider taking action against a compounder who used it.
          </p>
          <p className="mt-4 text-sm font-medium leading-7 text-[var(--muted)]">
            A larger group &mdash; among them BPC-157, CJC-1295, TB-500, MOTS-c, semax, epitalon, selank, melanotan II, GHK-Cu for injection, LL-37 and AOD-9604 &mdash; appears on the same FDA page in a second table, of substances that were previously in category 2 and whose nominations were then withdrawn by the people who filed them. Withdrawn is not the same as cleared. None of these is on the 503A list a pharmacy may compound from.
          </p>
          <p className="mt-4 text-sm font-medium leading-7 text-[var(--muted)]">
            And it is still moving. On 23&ndash;24 July 2026 the FDA&rsquo;s Pharmacy Compounding Advisory Committee met to discuss whether BPC-157, KPV, TB-500, MOTS-c, emideltide (DSIP), semax and epitalon should go on that list.
          </p>
          <div className="ink-1 mt-6 flex items-start gap-3 rounded-[14px] bg-[#fff4e0] p-4">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#b26a00]" />
            <p className="text-sm font-medium leading-6 text-[#111214]/80">
              <span className="font-extrabold">This section has a shelf life.</span> It was checked against the FDA&rsquo;s own pages on {CHECKED_ON}. Before you rely on any of it, open the sources at the bottom and look for yourself &mdash; and note that none of this is about whether a peptide is safe. It is about what a licensed pharmacy is permitted to make.
            </p>
          </div>
        </div>
      </section>

      {/* ── The actionable half ─────────────────────────────────────────────────────── */}
      <section className="border-y-2 border-[#111214] bg-white">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">What to actually do</p>
            <h2 className="mt-3 text-[clamp(2rem,5vw,3.6rem)] font-extrabold leading-[.95] tracking-[-.045em]">Ask. Then read the shape of the answer.</h2>
            <p className="mt-5 text-base font-medium leading-7 text-[var(--muted)]">
              You cannot inspect a factory. You can send a message and watch what comes back. A real answer is specific and checkable &mdash; including when the answer is no. A dodge answers a question you did not ask.
            </p>
          </div>
          <div className="mt-10 space-y-4">
            {ASKS.map((ask) => (
              <div key={ask.q} className="ink hard rounded-[20px] bg-white p-6 sm:p-7">
                <div className="flex items-start gap-3">
                  <span className="ink-1 mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-[#eef0ff]"><ShieldQuestion className="size-4 text-[#2b31d8]" /></span>
                  <h3 className="text-[clamp(1.05rem,2.4vw,1.3rem)] font-extrabold leading-[1.3] tracking-[-.03em]">{ask.q}</h3>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="ink-1 rounded-[16px] bg-[#e6fbf4] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#0e8f80]">A real answer</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-[#111214]/80">{ask.good}</p>
                  </div>
                  <div className="ink-1 rounded-[16px] bg-[#fff1f0] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d3372c]">A dodge</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-[#111214]/80">{ask.dodge}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="ink hard mt-4 rounded-[20px] bg-[#111214] p-6 text-white sm:p-8">
            <CircleDashed className="size-5 text-[#8fa2ff]" />
            <h3 className="mt-5 text-xl font-extrabold tracking-[-.03em]">A good answer is still only an answer</h3>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-white/55">
              A vendor who answers all five well has told you they are careful and candid. That is worth a great deal and it is not the same as proof. Nothing on this page, and nothing a vendor says, makes any product safe to put in your body &mdash; VialGrade never claims that about anything.
            </p>
          </div>
        </div>
      </section>

      {/* ── Look it up yourself ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Check it yourself</p>
          <h2 className="mt-3 text-[clamp(1.8rem,3.8vw,2.6rem)] font-extrabold tracking-[-.04em]">Five lookups, free, no account</h2>
          <p className="mt-4 text-sm font-medium leading-6 text-[var(--muted)]">
            None of these will tell you a product is safe. They will tell you whether a specific claim is true, which is a different and more useful thing.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Lookup
            href="https://www.fda.gov/drugs/drug-approvals-and-databases/drug-establishments-current-registration-site-decrs"
            title="Is that facility registered?"
            detail="The FDA publishes its register of drug establishments and updates it every business day. If a vendor names the facility that made something, look it up. Being listed tells you the establishment is registered — that, and nothing more."
          />
          <Lookup
            href="https://www.fda.gov/drugs/human-drug-compounding/registered-outsourcing-facilities"
            title="Is that pharmacy a 503B?"
            detail="A separate FDA list, because the register above deliberately leaves outsourcing facilities out. It shows each one’s last inspection — and a lot of rows say “Not yet inspected.” Registering is something a facility elects to do; it is not a pass mark."
          />
          <Lookup
            href="https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks"
            title="Has the FDA flagged this compound?"
            detail="The category 2 page lists what the FDA has flagged for compounding, with the specific concern written out for each substance. It is readable without a science degree."
          />
          <Lookup
            href="https://portal.a2la.org/search/falseclaims.cfm"
            title="Is that accreditation real?"
            detail="A2LA, one of the bodies that accredits testing labs, publishes a running list of companies caught claiming its accreditation without holding it — including a supplement brand whose test report carried the A2LA symbol without permission."
          />
          <Lookup
            internal
            href="/enforcement"
            title="Has this vendor been written to?"
            detail="Public FDA warning letters, import alerts, DOJ and FTC actions against sellers in this market — the ones we track, each with its source document linked."
          />
        </div>
      </section>

      {/* ── Sources, visible, with what each one backs ──────────────────────────────── */}
      <section className="border-y-2 border-[#111214] bg-white">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Sources</p>
            <h2 className="mt-3 text-[clamp(1.8rem,3.8vw,2.6rem)] font-extrabold tracking-[-.04em]">Every rule above, and where it came from</h2>
            <p className="mt-4 text-sm font-medium leading-6 text-[var(--muted)]">
              Primary documents only &mdash; the regulations themselves and the FDA&rsquo;s own pages. Checked {CHECKED_ON}. If one of these has moved since, the source wins and this page is wrong.
            </p>
          </div>
          <ol className="mt-8 space-y-3">
            {SOURCES.map((source, index) => (
              <li key={source.url} className="ink-1 hard rounded-[18px] bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[11px] font-extrabold tabular-nums text-[var(--muted)]">{index + 1}</span>
                  <h3 className="min-w-0 text-base font-extrabold leading-6 tracking-[-.02em]">{source.title}</h3>
                </div>
                <p className="mt-1.5 text-xs font-semibold text-[var(--muted)]">{source.publisher}</p>
                <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">{source.supports}</p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex max-w-full items-start gap-1.5 text-xs font-bold text-[#2b31d8] hover:underline"
                >
                  <span className="min-w-0 break-all">{source.url}</span>
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Where this lives on the rest of the site ────────────────────────────────── */}
      <section className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-20">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Keep going</p>
        <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold tracking-[-.04em]">The rest of the picture</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DeepLink href="/reference-standard" title="The real benchmark" detail="The regulated manufacturers whose peptides go into approved medicines — the bar everything else is measured against." />
          <DeepLink href="/how-we-check" title="How we check" detail="What a lab test proves, the six questions one report answers, and what we refuse to guess." />
          <DeepLink href="/research" title="Lab reports" detail="Every certificate we hold, what it establishes, and what stays unknown." />
          <DeepLink href="/legal/us-regulations" title="The law around this" detail="How research peptides are regulated in the US, in plain English." />
        </div>
        <div className="ink-1 mt-8 flex items-start gap-3 rounded-[14px] bg-[#fff4e0] p-4">
          <Scale className="mt-0.5 size-5 shrink-0 text-[#b26a00]" />
          <p className="text-sm font-medium leading-6 text-[#111214]/80">
            <span className="font-bold">General information, not legal or medical advice.</span> VialGrade sells nothing, recommends nothing, and encourages no human use. Nothing here says any product is safe, sterile, correctly dosed, or fit to use.
          </p>
        </div>
      </section>
    </>
  );
}

function Fact({ label, text, tone }: { label: string; text: string; tone?: "warn" | "muted" }) {
  const tint = tone === "warn" ? "bg-[#fff4e0]" : tone === "muted" ? "bg-[#f0f0ec]" : "bg-[var(--background)]";
  const labelTint = tone === "warn" ? "text-[#b26a00]" : "text-[var(--muted)]";
  return (
    <div className={`ink-1 rounded-[16px] p-4 ${tint}`}>
      <p className={`text-[10px] font-bold uppercase tracking-[.14em] ${labelTint}`}>{label}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-[#111214]/80">{text}</p>
    </div>
  );
}

function Lookup({ href, title, detail, internal }: { href: string; title: string; detail: string; internal?: boolean }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-extrabold leading-6 tracking-[-.025em]">{title}</h3>
        {internal ? <ArrowUpRight className="mt-1 size-4 shrink-0 text-[#111214]" /> : <ExternalLink className="mt-1 size-4 shrink-0 text-[#111214]" />}
      </div>
      <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">{detail}</p>
    </>
  );
  return internal ? (
    <Link href={href} className="ink-1 hard press rounded-[18px] bg-white p-6">{body}</Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className="ink-1 hard press block rounded-[18px] bg-white p-6">{body}</a>
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
