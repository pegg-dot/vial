import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleDashed, FlaskConical, Scale, Store, Factory, Package } from "lucide-react";
import { getCoverageReport, coverageGaps } from "@/server/analytics/coverage-report";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "What we hold — and what we don't",
  description:
    "Every record VialGrade has on the research-peptide market, counted live: compounds, vendors, listings, independent lab certificates and public enforcement records — together with the gaps we have not filled.",
  alternates: { canonical: "/coverage" },
};

// The page that makes the depth checkable.
//
// The instinct behind it was that a reader should understand how much is on record here. The
// numbers are worth publishing; a sentence praising our own even-handedness is not, and this page
// deliberately never writes one. Every directory in this market describes itself that way, so the
// words carry no information — and a site that announces its own lack of bias is doing exactly what
// a biased site would also do. A test fails if this file ever starts making that claim.
//
// What cannot be faked is publishing the holes. A list of what we do NOT have, in the same type
// size as what we do, is a claim a reader can check and a competitor cannot comfortably copy. So
// the gaps are here, counted from the same query as the totals, and phrased as limits of ours
// rather than faults of anyone's — the rule `absence.ts` exists to enforce.

function Figure({ icon: Icon, value, label, sub }: { icon: typeof Store; value: string; label: string; sub: string }) {
  return (
    <div className="ink hard rounded-[18px] bg-white p-5">
      <Icon className="size-5 text-[#2b31d8]" />
      <p className="mt-3 text-4xl font-extrabold tabular-nums tracking-[-.05em]">{value}</p>
      <p className="mt-1 text-sm font-bold">{label}</p>
      <p className="mt-1 text-xs font-medium leading-5 text-[var(--muted)]">{sub}</p>
    </div>
  );
}

export default async function CoveragePage() {
  const report = await getCoverageReport();
  const gaps = coverageGaps(report);
  const num = (v: number) => v.toLocaleString();
  const read = report.lastReadAt
    ? new Date(report.lastReadAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null;

  return (
    <>
      <section className="mx-auto max-w-[1320px] px-5 pb-8 pt-14 sm:px-8 sm:pt-20">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#2b31d8]">Coverage</p>
        <h1 className="mt-3 max-w-4xl text-balance text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[.95] tracking-[-.05em]">
          Everything we hold, and everything we don&rsquo;t.
        </h1>
        <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-[var(--muted)]">
          Counted from the database as this page loaded &mdash; not written down once and left to rot. The second half is
          the half that matters: the gaps are listed at the same size as the totals, because a record of what we are
          missing is the only part of a claim like this that a reader can actually check.
        </p>
        {read && <p className="mt-3 text-sm font-semibold text-[var(--muted)]">Catalogue last re-read {read}.</p>}
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-4 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Figure icon={FlaskConical} value={num(report.independentCertificates)} label="Independent lab certificates"
            sub={report.labs > 0
              ? `Read from ${num(report.labs)} third-party ${report.labs === 1 ? "laboratory" : "laboratories"}, never from a vendor's own word.`
              : "Read from third-party laboratories, never from a vendor's own word."} />
          <Figure icon={Package} value={num(report.listings)} label="Listings tracked"
            sub={`${num(report.listingsWithPrice)} carry a price we have re-read ourselves.`} />
          <Figure icon={Store} value={num(report.storefronts)} label="Storefronts"
            sub={`Shops you can actually buy from. ${num(report.gradedStorefronts)} carry a grade.`} />
          <Figure icon={Factory} value={num(report.makers)} label="Upstream makers"
            sub="The party a certificate names as having made the material — not a shop. Surfaced because who made it is the question behind who sells it." />
          <Figure icon={Scale} value={num(report.enforcementRecords)} label="Public enforcement records"
            sub={`FDA, DOJ and FTC actions naming ${num(report.vendorsNamedInEnforcement)} distinct subjects.`} />
          <Figure icon={CircleDashed} value={num(report.compounds)} label="Compounds"
            sub={report.compoundsWithTestedPurity > 0
              ? `${num(report.compoundsWithTestedPurity)} have an independently tested purity on record.`
              : "None yet has an independently tested purity on record."} />
        </div>
      </section>

      {/* The half a competitor would not print. */}
      <section className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8">
        <h2 className="text-3xl font-extrabold tracking-[-.035em]">What we don&rsquo;t have</h2>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
          Each of these is a limit of our own capture. None of them is a finding about a vendor or a compound: &ldquo;we
          hold no certificate for this&rdquo; is a fact about us, and it is not the same sentence as &ldquo;this is untested&rdquo;.
          We do not publish the second one.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {gaps.length === 0 ? (
            <p className="ink hard-sm rounded-[16px] bg-white p-5 text-sm font-semibold">
              Nothing outstanding in the three measures tracked here.
            </p>
          ) : gaps.map((g) => (
            <div key={g.weDoNotHold} className="ink hard rounded-[18px] bg-[#fff6e6] p-5">
              <p className="text-3xl font-extrabold tabular-nums tracking-[-.04em]">{num(g.count)}<span className="text-lg font-bold text-[#111214]/45"> / {num(g.outOf)}</span></p>
              <p className="mt-2 text-sm font-extrabold leading-5">We don&rsquo;t hold {g.weDoNotHold}.</p>
              <p className="mt-2 text-[13px] font-medium leading-6 text-[#111214]/70">{g.why}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-16 sm:px-8">
        <div className="ink hard rounded-[20px] bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold tracking-[-.03em]">Why the gaps are printed here</h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <p className="max-w-[68ch] text-[15px] font-medium leading-7 text-[#111214]/75">
              Every site in this market describes itself as thorough and even-handed, which is why those words are worth
              nothing. We are not going to add ours to the pile. What we can do instead is publish the arithmetic in
              both directions and let you check it: how many certificates, from how many laboratories, against how many
              listings &mdash; and how many of each we are still missing.
            </p>
            <p className="max-w-[68ch] text-[15px] font-medium leading-7 text-[#111214]/75">
              It also constrains us. A verdict on this site has to survive next to a public count of what we failed to
              gather, which makes a confident grade on thin evidence considerably harder to publish. That is the point.
              A record is only worth reading if the same page is willing to say where the record runs out.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/how-we-check" className="ink hard-sm press inline-flex items-center gap-2 rounded-full bg-[#2b31d8] px-5 py-2.5 text-sm font-bold text-white">
              How a record earns its place <ArrowRight className="size-4" />
            </Link>
            <Link href="/verify" className="ink hard-sm press inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold">
              Check a vendor or a COA <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
