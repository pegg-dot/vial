import type { Metadata } from "next";
import { ArrowUpRight, Building2, CircleAlert, CircleDashed, FileText, FlaskConical, Landmark, ScrollText, Scale, ShieldQuestion } from "lucide-react";
import { PURITY_IS_NOT_GRADE } from "@/lib/provenance-copy";
import { JsonLd } from "@/components/json-ld";
import { articleSchema } from "@/lib/structured-data";
import { CardLink, Chip, Frame, IconTile, Notice, NumberedSection, PageHero, Quiet, Section, UI } from "@/components/intelligence/research-ui";

export const metadata: Metadata = {
  title: "Purity vs grade",
  description: "“99% pure” and “pharmaceutical grade” are two different claims, and vendors blur them on purpose. What research-use-only, pharmaceutical grade, and GMP actually mean — and the documents that help evaluate manufacturing claims.",
  alternates: { canonical: "/grades" },
};

// Everything on this page that states a rule was read off a primary source and is listed in SOURCES
// below. The date is shown to the reader because the compounding rules in particular move: the FDA
// advisory committee met on this exact subject three weeks before this page was first written.
const CHECKED_ON = "16 October 2026";
// The same date, machine-readable, for the Article's dateModified. Kept as a literal beside the
// displayed string rather than derived from it so the rendered wording can never shift under a
// locale change; update both together.
const CHECKED_ON_ISO = "2026-10-16";

// The three words a buyer meets, in the order they escalate. Each one gets the same treatment:
// what it actually is, what it is NOT, and the thing you can say out loud to test it.
const LAYERS = [
  {
    eyebrow: "Layer 1",
    name: "“Research use only”",
    kicker: "A sentence about intended use. Not a quality tier.",
    icon: FlaskConical,
    tone: "white",
    is: "A line the seller prints on the label saying the contents are not meant for people. That is the whole of it.",
    isNot: "A grade. There is no purity bar a product has to clear to be called “research use only,” no inspection behind it, and no one checking. Two vials with the same disclaimer can be nothing alike.",
    tell: "Ask what standard it was made to, and who verified that. There is no standard behind the phrase, and a candid vendor will tell you so. The label is also not a shield: the FDA has told peptide sellers in writing that a “research use only” statement did not change what their products were — the letter is in the sources below.",
    here: "Essentially every compound record on VialGrade sits here.",
  },
  {
    eyebrow: "Layer 2",
    name: "“Pharmaceutical grade”",
    kicker: "A marketing phrase, unless a certificate is attached.",
    icon: ScrollText,
    tone: "warn",
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
    tone: "mint",
    is: "Good Manufacturing Practice — federal regulations covering the methods, facilities and controls used to make a drug. In plain terms: the rooms, the equipment, the staff, the incoming materials, the records, and who is allowed to sign off.",
    isNot: "Not something a lab report can establish. A certificate looks at a sample after the fact; GMP is about what happened in the building before the sample existed.",
    tell: "Ask for the certificate and the name of the body that issued it, and ask whether it covers the finished vial or a raw ingredient bought from someone else. Those are very different claims.",
    here: "Vanishingly rare in this market. Treat a bare “GMP” badge with no document as decoration.",
  },
] as const;

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
    dodge: "“We test every batch,” with no word on where the sample came from. A vendor-chosen sample can introduce selection bias; its results may not be representative of other inventory, regardless of what is later distributed.",
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
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      {/* An explainer with a stated fact-check date and a visible source list, so Article with a
          citation array describes it honestly. Not FAQPage: the "questions" on this page are
          questions to put to a VENDOR, and the text under each is what a good or evasive reply
          looks like — not this page answering itself. The citations are the same primary sources
          rendered at the bottom, so the markup claims nothing the reader cannot check. */}
      <JsonLd data={articleSchema({
        url: "/grades",
        headline: "“99.4% pure” is not a grade",
        description: "A purity number and a manufacturing standard are two different claims. What research-use-only, pharmaceutical grade, and GMP actually mean, and the question that separates them.",
        dateModified: CHECKED_ON_ISO,
        citations: SOURCES.map((source) => source.url),
      })} />

      <PageHero art={["coa", "shield", "vial"]}
        breadcrumb={[{ href: "/intelligence/market#browse", label: "Research Market" }, { label: "Purity vs grade" }]}
        eyebrow={<><FileText className="size-4" aria-hidden="true" /> Purity vs grade</>}
        title={<>&ldquo;99.4% pure&rdquo; is not <span className="text-[#2b31d8]">a grade.</span></>}
        lead="A purity number and a manufacturing standard are two different claims. Vendors let you hear them as one, because that gap is where this market does its selling. Here is the difference in plain English, and the one question that settles it."
        note={"Primary sources checked " + CHECKED_ON + " · general information, not legal or medical advice."}
      />

      <Section tight>
        <div className="grid gap-4">
          {/* ── The split, stated once, big ─────────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2">
            <Frame pad="lg">
              <Chip tone="blue" icon={FileText}>Purity</Chip>
              <h2 className={UI.h2 + " mt-5"}>What is in the vial</h2>
              <p className={UI.body + " mt-4"}>
                One lab took one sample, once, and measured how much of it was the peptide. That is the entire claim. It is a photograph of a sample, and the sample is not the batch.
              </p>
            </Frame>
            <Frame pad="lg">
              <Chip tone="mint" icon={Building2}>Grade</Chip>
              <h2 className={UI.h2 + " mt-5"}>How it was made</h2>
              <p className={UI.body + " mt-4"}>
                The room. The equipment and when it was last calibrated. Who was trained, and on what. What was cleaned between batches. Which records exist, and who signed them. A certificate cannot see any of it.
              </p>
            </Frame>
          </div>

          <Frame tone="blueSolid" pad="lg">
            <p className="text-[clamp(1.05rem,2.2vw,1.35rem)] font-extrabold leading-[1.45] tracking-[-.02em]">{PURITY_IS_NOT_GRADE}</p>
            <p className="mt-5 max-w-3xl text-sm font-medium leading-7 text-white/70">
              The two do not move together. A very high number can come out of an uncontrolled room. A controlled facility can report an ordinary one. So when a number is offered as the answer to &ldquo;is this well made,&rdquo; the question has been quietly swapped.
            </p>
          </Frame>

          {/* ── The three words ─────────────────────────────────────────────────────── */}
          <NumberedSection id="three-words" number={1} eyebrow="The three words" title="Only one of them means anything on its own"
            intro="These three get used as if they were rungs on one ladder. They are not. Two are descriptions of intent, and one is a regulation about a building.">
            {LAYERS.map((layer) => (
              <Quiet key={layer.name}>
                <div className="grid gap-5 lg:grid-cols-[.62fr_1.38fr]">
                  <div>
                    <div className="flex items-center gap-3">
                      <IconTile icon={layer.icon} tone={layer.tone} size="sm" />
                      <p className={UI.eyebrowMuted}>{layer.eyebrow}</p>
                    </div>
                    <h3 className={UI.h3 + " mt-4"}>{layer.name}</h3>
                    <p className="mt-2 text-sm font-bold leading-6 text-[#2b31d8]">{layer.kicker}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Fact label="What it is" text={layer.is} />
                    <Fact label="What it is not" text={layer.isNot} tone="warn" />
                    <Fact label="How to test it" text={layer.tell} />
                    <Fact label="Where you meet it" text={layer.here} tone="muted" />
                  </div>
                </div>
              </Quiet>
            ))}
          </NumberedSection>

          {/* ── Compounding: a different lane entirely ──────────────────────────────── */}
          <NumberedSection id="compounding" number={2} eyebrow="Compounded is a fourth thing" title="A pharmacy is not a website">
            <p className={UI.body + " max-w-3xl leading-7"}>
              A clinic or telehealth service advertising a peptide does not establish that the product was legally compounded. Section 503A sets requirements for qualifying patient-specific compounding by licensed pharmacists or physicians; section 503B addresses registered outsourcing facilities under different conditions. A clinic advertisement, a prescription, or a research-use label alone is not proof of compliance.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <Quiet>
                <Chip tone="blue" icon={Landmark}>503A</Chip>
                <h3 className={UI.h4 + " mt-4"}>A state-licensed pharmacy</h3>
                <p className={UI.body + " mt-2"}>
                  State boards of pharmacy oversee licensed pharmacies alongside applicable federal rules. A drug compounded in full compliance with section 503A qualifies for exemptions from specified federal requirements, including section 501(a)(2)(B) current good manufacturing practice requirements. It is not a general exemption for all products made or marketed by a pharmacy.
                </p>
              </Quiet>
              <Quiet>
                <Chip tone="mint" icon={Landmark}>503B</Chip>
                <h3 className={UI.h4 + " mt-4"}>An outsourcing facility</h3>
                <p className={UI.body + " mt-2"}>
                  A category created in 2013. These register with the FDA, are inspected by the FDA on a risk-based schedule, and <span className="font-bold text-[#111214]">are</span> subject to GMP. This is the stricter of the two.
                </p>
              </Quiet>
            </div>
            <Notice tone="blue" icon={Scale}>
              <h3 className={UI.h4}>The line the FDA draws, which is this whole page in one rule</h3>
              <p className="mt-2 leading-7">
                Eligible bulk ingredients in qualifying section 503A compounding generally require a valid certificate of analysis and must meet applicable establishment-registration and other sourcing conditions. The ingredient must also meet the appropriate eligibility pathway under section 503A. A COA alone cannot establish those conditions, much less approval of a finished drug or proof of the contents of any later vial.
              </p>
            </Notice>
            <Quiet>
              <h3 className={UI.h4}>Where the well-known peptides actually stand</h3>
              <p className={UI.body + " mt-3 leading-7"}>
                The FDA keeps a public list of bulk substances it has flagged as possibly presenting significant safety risks in compounding &mdash; &ldquo;category 2.&rdquo; On 29 September 2023 it added several peptide substances, including GHRP-2, GHRP-6, ipamorelin acetate and kisspeptin-10. For a substance in category 2, the FDA says it would consider taking action against a compounder who used it.
              </p>
              <p className={UI.body + " mt-4 leading-7"}>
                A larger group &mdash; among them BPC-157, CJC-1295, TB-500, MOTS-c, semax, epitalon, selank, melanotan II, GHK-Cu for injection, LL-37 and AOD-9604 &mdash; appears on the same FDA page in a second table, of substances that were previously in category 2 and whose nominations were then withdrawn by the people who filed them. Withdrawn is not the same as cleared. A withdrawn nomination is not affirmative authorization to compound. Status must be checked substance by substance against current FDA decisions and the applicable 503A pathways, rather than assumed from a static web list.
              </p>
              <p className={UI.body + " mt-4 leading-7"}>
                And it is still moving. On 23&ndash;24 July 2026 the FDA&rsquo;s Pharmacy Compounding Advisory Committee met to discuss whether BPC-157, KPV, TB-500, MOTS-c, emideltide (DSIP), semax and epitalon should go on that list.
              </p>
              <Notice tone="warn" icon={CircleAlert} className="mt-5">
                <p>
                  <span className="font-extrabold">This section has a shelf life.</span> It was checked against the FDA&rsquo;s own pages on {CHECKED_ON}. Before you rely on any of it, open the sources at the bottom and look for yourself &mdash; and note that none of this is about whether a peptide is safe. It is about what a licensed pharmacy is permitted to make.
                </p>
              </Notice>
            </Quiet>
          </NumberedSection>

          {/* ── The actionable half ─────────────────────────────────────────────────── */}
          <NumberedSection id="ask" number={3} eyebrow="What to actually do" title="Ask, then read the shape of the answer"
            intro="You cannot inspect a factory. You can send a message and watch what comes back. A real answer is specific and checkable — including when the answer is no. A dodge answers a question you did not ask.">
            {ASKS.map((ask) => (
              <Quiet key={ask.q}>
                <div className="flex items-start gap-3">
                  <IconTile icon={ShieldQuestion} size="sm" />
                  <h3 className={UI.h4 + " leading-6"}>{ask.q}</h3>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Notice tone="mint" title="A real answer"><p>{ask.good}</p></Notice>
                  <Notice tone="danger" title="A dodge"><p>{ask.dodge}</p></Notice>
                </div>
              </Quiet>
            ))}
            <Notice tone="warn" icon={CircleDashed}>
              <h3 className={UI.h4}>A good answer is still only an answer</h3>
              <p className="mt-2 leading-7">
                A vendor who answers all five well has told you they are careful and candid. That is worth a great deal and it is not the same as proof. Nothing on this page, and nothing a vendor says, makes any product safe to put in your body &mdash; VialGrade never claims that about anything.
              </p>
            </Notice>
          </NumberedSection>

          {/* ── Look it up yourself ─────────────────────────────────────────────────── */}
          <NumberedSection id="lookups" number={4} eyebrow="Check it yourself" title="Five lookups, free, no account"
            intro="None of these will tell you a product is safe. They will tell you whether a specific claim is true, which is a different and more useful thing.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CardLink external
                href="https://www.fda.gov/drugs/drug-approvals-and-databases/drug-establishments-current-registration-site-decrs"
                title="Is that facility registered?"
                body="The FDA publishes its register of drug establishments and updates it every business day. If a vendor names the facility that made something, look it up. Being listed tells you the establishment is registered — that, and nothing more."
              />
              <CardLink external
                href="https://www.fda.gov/drugs/human-drug-compounding/registered-outsourcing-facilities"
                title="Is that pharmacy a 503B?"
                body="A separate FDA list, because the register above deliberately leaves outsourcing facilities out. It shows each one’s last inspection — and a lot of rows say “Not yet inspected.” Registering is something a facility elects to do; it is not a pass mark."
              />
              <CardLink external
                href="https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks"
                title="Has the FDA flagged this compound?"
                body="The category 2 page lists what the FDA has flagged for compounding, with the specific concern written out for each substance. It is readable without a science degree."
              />
              <CardLink external
                href="https://portal.a2la.org/search/falseclaims.cfm"
                title="Is that accreditation real?"
                body="A2LA, one of the bodies that accredits testing labs, publishes a running list of companies caught claiming its accreditation without holding it — including a supplement brand whose test report carried the A2LA symbol without permission."
              />
              <CardLink
                href="/vendors"
                title="Has this vendor been written to?"
                body="Public FDA warning letters, import alerts, DOJ and FTC actions against sellers in this market — the ones we track, each with its source document linked, on the vendor’s own record."
              />
            </div>
          </NumberedSection>

          {/* ── Sources, visible, with what each one backs ──────────────────────────── */}
          <NumberedSection id="sources" number={5} eyebrow="Sources" title="Every rule above, and where it came from"
            intro={"Primary documents only — the regulations themselves and the FDA’s own pages. Checked " + CHECKED_ON + ". If one of these has moved since, the source wins and this page is wrong."}>
            <ol className="space-y-3">
              {SOURCES.map((source, index) => (
                <Quiet as="li" key={source.url}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-[11px] font-extrabold tabular-nums text-[#2b31d8]">{index + 1}</span>
                    <h3 className={UI.h4 + " min-w-0 leading-6"}>{source.title}</h3>
                  </div>
                  <p className={UI.small + " mt-1"}>{source.publisher}</p>
                  <p className={UI.body + " mt-2"}>{source.supports}</p>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className={UI.linkSmall + " mt-2 max-w-full items-start"}>
                    <span className="min-w-0 break-all">{source.url}</span>
                    <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </Quiet>
              ))}
            </ol>
          </NumberedSection>

          {/* ── Where this lives on the rest of the site ────────────────────────────── */}
          <NumberedSection id="keep-going" number={6} eyebrow="Keep going" title="The rest of the picture">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CardLink href="/intelligence/grading" title="How research files are graded" body="The three source checks behind every research file letter, and why a letter is not a quality claim." />
              <CardLink href="/how-we-check" title="How we check" body="What a lab test proves, the six questions one report answers, and what we refuse to guess." />
              <CardLink href="/intelligence" title="Research records" body="Every compound we track, with its original sources and what stays unknown." />
              <CardLink href="/legal/us-regulations" title="The law around this" body="How research peptides are regulated in the US, in plain English." />
            </div>
            <Notice tone="warn" icon={Scale}>
              <p>
                <span className="font-bold">General information, not legal or medical advice.</span> VialGrade sells nothing, recommends nothing, and encourages no human use. Nothing here says any product is safe, sterile, correctly dosed, or fit to use.
              </p>
            </Notice>
          </NumberedSection>
        </div>
      </Section>
    </div>
  );
}

// One cell of a layer's four-up: a label and a sentence. The warn tone marks "what it is not".
function Fact({ label, text, tone }: { label: string; text: string; tone?: "warn" | "muted" }) {
  const tint = tone === "warn" ? "bg-[#fff3d8]" : tone === "muted" ? "bg-[var(--background)]" : "bg-white";
  const labelTint = tone === "warn" ? "text-[#9b6b22]" : "text-[#4a4d56]";
  return (
    <div className={"ink-1 rounded-[14px] p-4 " + tint}>
      <p className={"text-[10px] font-extrabold uppercase tracking-[.14em] " + labelTint}>{label}</p>
      <p className={UI.bodyInk + " mt-2"}>{text}</p>
    </div>
  );
}
