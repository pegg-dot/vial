import type { Metadata } from "next";
import { ArrowDown, Check, CircleAlert, CircleDashed, Database, Fingerprint, Scale, ShieldCheck } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { articleSchema } from "@/lib/structured-data";
import { CardLink, Frame, IconTile, PageHero, Section, SectionHeading, UI } from "@/components/intelligence/research-ui";

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

export default function HowWeCheckPage() {
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
        breadcrumb={[{ href: "/intelligence/market#browse", label: "Research Market" }, { label: "How we check" }]}
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

      <Section band="white">
        <SectionHeading eyebrow="Go deeper" title="The full records, if you want them" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardLink href="/passports" title="Batch test records" body="The complete test record for a specific batch — including results that disagree." />
          <CardLink href="/intelligence" title="Research records" body="Every compound we track, with its original sources and what stays unknown." />
          <CardLink href="/intelligence/materials" title="Research material checks" body="What has been independently checked about a research material, what has not, and why sample origin matters." />
          <CardLink href="/labs" title="Laboratories" body="Who runs the tests, their methods, and their report history." />
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
