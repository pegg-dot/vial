import type { Metadata } from "next";
import { AlertTriangle, BadgeCheck, Fingerprint, ScanLine } from "lucide-react";
import { countPublicPassports, listPublicPassports } from "@/server/evidence-network/repository";
import { reportError } from "@/server/observability/alerts";
import { hidesCommerce } from "@/lib/public-research-release";
import { DataUnavailable } from "@/components/home-data-unavailable";
import { PassportsClient } from "@/components/passports-client";
import { Frame, PageHero, Pill, Section, StatRow, TONE_ACCENT, UI } from "@/components/intelligence/research-ui";
import {
  PASSPORT_EVIDENCE_FACETS,
  PASSPORT_ORIGIN_FACETS,
  type PassportEvidenceId,
  type PassportOriginId,
} from "@/lib/passport-filter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Batch test records",
  description: "The full test history for one batch: who picked the sample, who tested it, what came back, and where results disagree.",
  alternates: { canonical: "/passports" },
};

const ORIGIN_IDS = new Set<string>(PASSPORT_ORIGIN_FACETS.map((facet) => facet.id));
const EVIDENCE_IDS = new Set<string>(PASSPORT_EVIDENCE_FACETS.map((facet) => facet.id));

/** searchParams are attacker-controlled. Seed the client only with values it could have produced. */
function asList(value: string | string[] | undefined, allowed: Set<string>) {
  const raw = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return Array.from(new Set(raw.filter((item) => allowed.has(item))));
}

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; origin?: string | string[]; evidence?: string | string[] }> }) {
  // Degrade rather than 500, and never to an empty grid that reads as "no batches have ever been
  // tested" — that is a false claim about the evidence corpus, which is the whole product.
  const [params, passports, total] = await Promise.all([
    searchParams,
    listPublicPassports().catch((error) => {
      reportError({ kind: "passports-unavailable", message: "The batch passport list could not be read.", context: { error: String(error) } });
      return null;
    }),
    // The list is capped, so its length is a page size. This page makes factual claims about the
    // evidence corpus ("no batch on record matches that"), and those may only rest on the real count.
    countPublicPassports().catch(() => null),
  ]);
  if (!passports) return <DataUnavailable surface="the batch test records" />;

  // The masthead's first figure is the real count when we have it; the second is counted over the
  // loaded page, so its label says so whenever the page is not the whole corpus.
  const truncated = total !== null && total > passports.length;
  const disagreeing = passports.filter((p) => Number(p.open_conflicts ?? 0) > 0).length;
  // The original testing and verify pages are closed under the evidence-only release; the research
  // product's equivalents answer the same two questions.
  const noCommerce = hidesCommerce();
  const testingHref = noCommerce ? "/intelligence/materials" : "/testing";
  const verifyHref = "/intelligence/verify";

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["coa", "magnifier"]}
        breadcrumb={[{ href: "/intelligence", label: "Home" }, { label: "Batch records" }]}
        eyebrow={<><Fingerprint className="size-4" aria-hidden="true" /> Batch test records</>}
        title="The full test record for a batch."
        lead={<>When a batch gets tested, everything lands here: who picked the sample, who tested it, what came back &mdash; including results that disagree.</>}
        note="This never says every vial is the same, or safe to use.">
        <StatRow className="mt-8" items={[
          { value: total ?? passports.length, label: total !== null ? "Batch records published" : "Batch records loaded" },
          { icon: AlertTriangle, value: disagreeing, label: truncated ? `With results that disagree, of the newest ${passports.length}` : "With results that disagree" },
        ]} />
      </PageHero>

      <Section tight>
        {/* An empty corpus is a real, meaningful state and not the same thing as a failed read: the
            list is genuinely empty until a lab result is attached to a batch. Saying so beats a
            blank grid followed by two cards explaining what "tested" means about nothing. */}
        {passports.length === 0 ? (
          <Frame pad="lg" className="py-16 text-center">
            <p className={UI.h3}>No batch test records published yet.</p>
            <p className={UI.body + " mx-auto mt-2 max-w-lg"}>
              A batch appears here once a lab result is attached to it and that record is reviewed and published.
              Nothing has failed and nothing is hidden &mdash; there is simply nothing on the record yet.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Pill href={testingHref} variant="ink" icon={ScanLine}>How testing works</Pill>
              <Pill href="/how-we-check">How we check</Pill>
            </div>
          </Frame>
        ) : (
          <PassportsClient
            passports={passports}
            total={total}
            verifyHref={verifyHref}
            initialQuery={typeof params.q === "string" ? params.q.slice(0, 120) : ""}
            initialOrigins={asList(params.origin, ORIGIN_IDS) as PassportOriginId[]}
            initialEvidence={asList(params.evidence, EVIDENCE_IDS) as PassportEvidenceId[]}
          />
        )}

        <div className="mt-8 grid items-start gap-4 md:grid-cols-2">
          <Frame tone="mint">
            <BadgeCheck className={"size-5 " + TONE_ACCENT.mint} aria-hidden="true" />
            <h2 className={UI.h3 + " mt-4"}>&ldquo;Tested&rdquo; means that sample was tested.</h2>
            <p className={UI.bodyInk + " mt-2"}>
              A pass tells you what one lab found in one sample, and how that sample was handled. It says nothing
              about the other vials in the batch.
            </p>
          </Frame>
          <Frame tone="warn">
            <AlertTriangle className={"size-5 " + TONE_ACCENT.warn} aria-hidden="true" />
            <h2 className={UI.h3 + " mt-4"}>When results disagree, we show both.</h2>
            <p className={UI.bodyInk + " mt-2"}>
              We never average a disagreement away. Conflicting results stay on the record until more testing
              settles it.
            </p>
          </Frame>
        </div>
      </Section>
    </div>
  );
}
