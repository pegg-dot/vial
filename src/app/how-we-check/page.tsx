import type { Metadata } from "next";
import { ArrowDown, ArrowRight, BookOpenCheck, Check, CircleAlert, CircleDashed, ClipboardCheck, Database, Fingerprint, FlaskConical, Scale, ShieldCheck } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { articleSchema } from "@/lib/structured-data";
import Link from "next/link";
import { evidenceOnlyPublicRelease, publicBrowseRelease } from "@/lib/public-research-release";
import { ResearchFileGradeCard } from "@/components/intelligence/research-file-grade";
import { FILE_GRADE_CURATION_DATE, FILE_GRADE_LIMITS, FILE_GRADE_METHOD_VERSION } from "@/lib/research-file-grade";
import { RESEARCH_SUBJECTS } from "@/lib/research-explorer";
import { CardLink, Frame, IconTile, Notice, NumberedSection, PageHero, Quiet, Section, SectionHeading, UI } from "@/components/intelligence/research-ui";

export const metadata: Metadata = {
  title: "How we check",
  description: "How VialGrade decides what counts as proof: lab reports, batch matching, who picked the sample, and what we refuse to guess about.",
  alternates: { canonical: "/how-we-check" },
};

// The rungs used to be labelled with their internal codes (D0, D1, S1–S4). Nobody buying a peptide
// knows what "S3" means, and the code was doing no work the plain title wasn't already doing.
const ladder = [
  { title: "We found a document", detail: "A lab report or vendor page exists and we saved a copy. That's all it proves so far — anyone can post a PDF." },
  { title: "The lab confirms it's theirs", detail: "The laboratory named on the report confirms it really issued it. The paper is genuine — this is where a QR-verifiable COA gets you." },
  { title: "Tested — but the vendor picked the sample", detail: "A real sample was tested, but the vendor chose which vial went to the lab. A cherry-picked winner proves less than it looks like." },
  { title: "Tested from a customer's sealed unit", detail: "A customer sent in a sealed unit with documented handling. Harder to game — this is what actually shipped." },
  { title: "Tested from a blind purchase", detail: "Someone independent bought the product like any customer would and sent it for testing. The vendor never saw it coming." },
  { title: "Tested repeatedly, from separate sources", detail: "Multiple units of the same batch, bought separately, came back consistent. The strongest evidence we track." },
];

const reportQuestions = [
  { title: "Is the report real?", detail: "Was it genuinely issued by the lab whose name is on it?" },
  { title: "Is it for this batch?", detail: "Does the report's batch number match the batch actually being sold?" },
  { title: "Is it the right compound?", detail: "Did the tested sample match what the label claims it is?" },
  { title: "Is the dose really there?", detail: "Was the amount measured independently, or just printed on the label?" },
  { title: "Who picked the sample?", detail: "A vendor-picked sample and a blind purchase are very different proof." },
  { title: "Is it clean?", detail: "Were sterility, endotoxin, or particulates separately checked? Usually they weren't — we say so." },
];

// The research-file letters (A/B/C) were a page of their own at /intelligence/grading; they are one
// section of the method now. Same checks, same four worked examples, same limits.
const FILE_CHECKS = [
  { icon: BookOpenCheck, name: "Molecular reference", description: "A specific public compound identity source. A substance SID or unresolved variant requires explicit qualification and prevents a letter." },
  { icon: ClipboardCheck, name: "Named registry intervention", description: "One selected ClinicalTrials.gov study previously checked for the exact named intervention. This does not cover all clinical studies or their outcomes." },
  { icon: FlaskConical, name: "Original experiment", description: "One specific primary article individually inspected for the named molecule and experimental model, not just a search hit or a review." },
] as const;
const FILE_SCALE = [["A", "3 linked layers"], ["B", "2 linked layers"], ["C", "1 linked layer"], ["—", "Exact identity unresolved"]] as const;
const FILE_EXAMPLES = ["pexiganan", "cagrilintide", "magainin-2", "retatrutide"].map((slug) => RESEARCH_SUBJECTS.find((subject) => subject.slug === slug)!);

export default function HowWeCheckPage() {
  // The batch-record and laboratory directories exist only under the browse release.
  const directories = !evidenceOnlyPublicRelease() || publicBrowseRelease();
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      {/* Article, not FAQPage. The "one report answers six questions" block looks like a FAQ, but
          each item's body restates the question rather than answering it — marking that up as an
          acceptedAnswer would be exactly the structured-data-to-page mismatch search engines
          penalize. The page as a whole is an editorial explainer, which is what Article says. */}
      <JsonLd data={articleSchema({
        url: "/how-we-check",
        headline: "Trust is a chain of evidence, not a green check",
        description: "How VialGrade decides what counts as proof: the evidence ladder, the six questions one lab report can be asked, and the claims we refuse to make.",
      })} />

      <PageHero art={["shield", "coa", "vial"]}
        breadcrumb={[{ href: "/intelligence", label: "Home" }, { label: "How we check" }]}
        eyebrow={<><ShieldCheck className="size-4" aria-hidden="true" /> How we check</>}
        title={<>Trust is a chain of evidence, <span className="text-[#2b31d8]">not a green check.</span></>}
        lead="A laboratory report may establish narrow facts about an identified sample. This page shows how VialGrade organizes those facts, what different forms of provenance mean, and what remains unverified. No report is a purchasing or safety recommendation."
      />

      <Section tight>
        <div className="grid gap-4 md:grid-cols-3">
          <Principle level={2} icon={Database} title="We keep the receipts" detail="A saved, timestamped copy of what every vendor and lab actually showed — so history can't be quietly rewritten." />
          <Principle level={2} icon={CircleDashed} title="We don't hide what's missing" detail="No sterility test? We say so, instead of quietly rounding it up to “trusted.” Unknown always stays visible." />
          <Principle level={2} icon={ShieldCheck} title="Major claims need review" detail="VialGrade aims to require supporting primary sources and human escalation for adverse vendor allegations. We have not independently established that every historical publication met this standard." />
        </div>
      </Section>

      <Section band="white">
        <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading eyebrow="The evidence ladder" title="How much a lab test really proves"
              lead={<>&ldquo;Lab tested&rdquo; can mean six very different things. Every batch record on VialGrade says which of these six it is. Further down the list means stronger proof &mdash; it does not mean &ldquo;safe&rdquo;.</>} />
          </div>
          <div className="space-y-3">
            {ladder.map((item, index) => (
              <Frame key={item.title} shadow="sm" pad="sm" className="relative grid gap-4 sm:grid-cols-[64px_1fr]">
                <span className="ink grid size-14 place-items-center rounded-2xl bg-[#111214] text-lg font-extrabold text-white">{index + 1}</span>
                <div>
                  <h3 className={UI.h3}>{item.title}</h3>
                  <p className={UI.body + " mt-2"}>{item.detail}</p>
                </div>
                {index < ladder.length - 1 && <ArrowDown aria-hidden="true" className="absolute -bottom-[14px] left-[36px] z-10 size-5 rounded-full border-2 border-[#111214] bg-white p-0.5 text-[#111214]" />}
              </Frame>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Reading a lab report" title="One report answers six separate questions"
          lead="A polished-looking COA can still dodge most of these. On every batch record, VialGrade answers each one separately — established, partial, or unknown." />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reportQuestions.map((q) => (
            <Frame key={q.title} shadow="sm">
              <h3 className={UI.h3}>{q.title}</h3>
              <p className={UI.body + " mt-2"}>{q.detail}</p>
            </Frame>
          ))}
        </div>
      </Section>

      <Section id="limitations" band="white">
        <SectionHeading eyebrow="Limitations by design" title="What we refuse to imply" />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Principle icon={CircleDashed} title="No single safety score" detail="Identity, dose, purity, sterility, and legality are different questions. One number would hide whichever answer is missing." />
          <Principle icon={CircleAlert} title="A real COA isn't a guarantee" detail="A genuine report proves the document is genuine. It can't prove the vial in your hand matches the tested sample." />
          <Principle icon={Scale} title="No legal shortcuts" detail="Regulatory information is dated, jurisdiction-specific, and reviewed before it's published." />
          <Principle icon={Fingerprint} title="No anonymous accusations" detail="A scam flag needs a visible evidence trail, a confidence level, and a way for the accused to dispute it." />
        </div>
      </Section>

      <Section id="governance">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          <SectionHeading eyebrow="Governance" title="Automation is not legal verification"
            lead="Automation collects and organizes records. Its outputs are not legal determinations, and source provenance and editorial oversight must be reviewed before making claims about people or businesses." />
          <Frame pad="lg" className="divide-y divide-[#111214]/10">
            <GovernanceRow icon={Database} title="Nothing is rewritten" detail="Every published change keeps the original snapshot and timestamp behind it." />
            <GovernanceRow icon={Check} title="Structured before reviewed" detail="Extracted claims must fit typed fields before they can even enter review." />
            <GovernanceRow icon={ShieldCheck} title="Human review is required for high-impact claims" detail="New accusations, legal-status conclusions and adverse findings must undergo documented source review and an accountable human decision. Historical records require retrospective audit." />
          </Frame>
        </div>
      </Section>

      <Section id="research-files" band="mint">
        <SectionHeading eyebrow="Research file letters" title="What have we actually checked?"
          lead={<>The letter on a research file grades the completeness of a VialGrade starter FILE, not the peptide itself. It cannot tell you whether a molecule is promising, safe, effective, or worth obtaining. Method {FILE_GRADE_METHOD_VERSION} &middot; audited source list dated {FILE_GRADE_CURATION_DATE} &middot; file coverage is not a quality claim.</>} />
        <div className="mt-8 grid gap-4">
          <NumberedSection id="grade-checks" number={1} eyebrow="Source checks" title="Three visible source checks"
            intro="A letter counts how many of these three kinds of original source are individually anchored in the file.">
            <div className="grid gap-3 md:grid-cols-3">
              {FILE_CHECKS.map(({ icon, name, description }) => (
                <Quiet key={name}>
                  <IconTile icon={icon} size="sm" />
                  <h3 className={UI.h4 + " mt-3"}>{name}</h3>
                  <p className={UI.small + " mt-1.5"}>{description}</p>
                </Quiet>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {FILE_SCALE.map(([letter, note]) => (
                <div key={letter} className="ink-1 flex items-center gap-3 rounded-[14px] bg-white p-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-[#111214] text-lg font-black text-white">{letter}</span>
                  <span className="text-xs font-bold text-[#3a3d46]">{note}</span>
                </div>
              ))}
            </div>
            <Notice tone="warn">
              <p>An A here is not scientifically stronger than a C. We only count the kinds of original sources individually anchored in this starter file. No selected trial or paper means not reviewed here, not that no such source exists.</p>
            </Notice>
          </NumberedSection>

          <NumberedSection id="grade-examples" number={2} eyebrow="Examples" title="Four examples with the checks exposed"
            intro="The same card every research file shows, with each check and its original link visible.">
            <div className="grid gap-4 lg:grid-cols-2">
              {FILE_EXAMPLES.map((subject) => (
                <div key={subject.slug} className="min-w-0">
                  <Link href={"/compounds/" + subject.slug} className={UI.link + " mb-3"}>
                    {subject.name} research file <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                  <ResearchFileGradeCard subject={subject} compact />
                </div>
              ))}
            </div>
          </NumberedSection>

          <NumberedSection id="grade-limits" number={3} eyebrow="Limits" title="Why this is not a scientific certainty grade">
            <Notice tone="warn"><p>{FILE_GRADE_LIMITS}</p></Notice>
            <p className={UI.bodyInk + " leading-7"}>
              A formal assessment of the certainty of evidence about a specific outcome requires appraisal of study bias, consistency, relevance, precision, and publication bias. We have not performed that expert assessment for these subjects.
            </p>
            <p className={UI.small}>
              Background: <a href="https://training.cochrane.org/handbook/current/chapter-14" target="_blank" rel="noopener noreferrer" className={UI.linkSmall}>Cochrane certainty-of-evidence method</a> &middot; <a href="https://ncats.nih.gov/about/about-translational-science/spectrum" target="_blank" rel="noopener noreferrer" className={UI.linkSmall}>NIH translational research stages</a>.
            </p>
          </NumberedSection>
        </div>
      </Section>

      <Section band="white">
        <SectionHeading eyebrow="Go deeper" title="The full records, if you want them" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {directories && <CardLink href="/passports" title="Batch test records" body="The complete test record for a specific batch — including results that disagree." />}
          <CardLink href="/intelligence" title="Research records" body="Every research subject on file, with its original sources and what stays unknown." />
          <CardLink href="/intelligence/materials" title="Research material checks" body="What has been independently checked about a research material, what has not, and why sample origin matters." />
          {directories && <CardLink href="/labs" title="Laboratories" body="Who runs the tests, their methods, and their report history." />}
        </div>
      </Section>
    </div>
  );
}

// A principle card. Level 2 where it sits straight under the page title, level 3 under a section heading.
function Principle({ icon, title, detail, level = 3 }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string; level?: 2 | 3 }) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <Frame>
      <IconTile icon={icon} />
      <Heading className={UI.h3 + " mt-5"}>{title}</Heading>
      <p className={UI.body + " mt-2"}>{detail}</p>
    </Frame>
  );
}

function GovernanceRow({ icon, title, detail }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string }) {
  return (
    <div className="flex gap-4 py-5 first:pt-0 last:pb-0">
      <IconTile icon={icon} size="sm" tone="mint" />
      <div>
        <h3 className={UI.h4}>{title}</h3>
        <p className={UI.body + " mt-1.5"}>{detail}</p>
      </div>
    </div>
  );
}
