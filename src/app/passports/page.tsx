import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, ScanLine } from "lucide-react";
import { countPublicPassports, listPublicPassports } from "@/server/evidence-network/repository";
import { reportError } from "@/server/observability/alerts";
import { DataUnavailable } from "@/components/home-data-unavailable";
import { PassportsClient } from "@/components/passports-client";
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

  return (
    <div>
      <section className="border-b-2 border-[#111214]">
        <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-24">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#6d5dfc]">Batch test records</p>
          <h1 className="mt-4 max-w-5xl text-5xl font-extrabold tracking-[-.065em] sm:text-7xl">The full test record for a batch.</h1>
          <p className="mt-6 max-w-3xl text-base font-medium leading-7 text-[var(--muted)]">
            When a batch gets tested, everything lands here: who picked the sample, who tested it, what came back
            &mdash; including results that disagree. This never says every vial is the same, or safe to use.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
        {/* An empty corpus is a real, meaningful state and not the same thing as a failed read: the
            list is genuinely empty until a lab result is attached to a batch. Saying so beats a
            blank grid followed by two cards explaining what "tested" means about nothing. */}
        {passports.length === 0 ? (
          <div className="ink hard rounded-[20px] bg-white px-6 py-16 text-center">
            <p className="text-lg font-extrabold">No batch test records published yet.</p>
            <p className="mx-auto mt-2 max-w-lg text-sm font-medium leading-6 text-[var(--muted)]">
              A batch appears here once a lab result is attached to it and that record is reviewed and published.
              Nothing has failed and nothing is hidden &mdash; there is simply nothing on the record yet.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/testing" className="ink hard-sm press inline-flex items-center gap-1.5 rounded-full bg-[#111214] px-5 py-2.5 text-sm font-bold text-white">
                How testing works <ScanLine className="size-4" />
              </Link>
              <Link href="/how-we-check" className="ink-1 hard-sm press rounded-full bg-white px-5 py-2.5 text-sm font-bold">How we check</Link>
            </div>
          </div>
        ) : (
          <PassportsClient
            passports={passports}
            total={total}
            initialQuery={typeof params.q === "string" ? params.q.slice(0, 120) : ""}
            initialOrigins={asList(params.origin, ORIGIN_IDS) as PassportOriginId[]}
            initialEvidence={asList(params.evidence, EVIDENCE_IDS) as PassportEvidenceId[]}
          />
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="ink-1 hard rounded-[18px] bg-[#e6fbf4] p-6">
            <BadgeCheck className="size-5 text-[#0e8f80]" />
            <h2 className="mt-4 text-xl font-extrabold">&ldquo;Tested&rdquo; means that sample was tested.</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[#0e8f80]">
              A pass tells you what one lab found in one sample, and how that sample was handled. It says nothing
              about the other vials in the batch.
            </p>
          </div>
          <div className="ink-1 hard rounded-[18px] bg-[#fff4e0] p-6">
            <AlertTriangle className="size-5 text-[#b26a00]" />
            <h2 className="mt-4 text-xl font-extrabold">When results disagree, we show both.</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[#b26a00]">
              We never average a disagreement away. Conflicting results stay on the record until more testing
              settles it.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
