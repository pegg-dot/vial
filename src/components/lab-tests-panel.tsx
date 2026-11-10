import type { ComponentType, ReactNode } from "react";
import { ArrowUpRight, FileText, FlaskConical, BadgeCheck, EyeOff, ShieldCheck, AlertTriangle } from "lucide-react";
import type { LabTestRow } from "@/server/ingest/lab-tests";
import { checkContent } from "@/server/verify/content-check";
import { Chip, NumberedSection, Quiet, SectionHeading, Stat, UI, type Tone } from "@/components/intelligence/research-ui";
import { ExpandableRows } from "./expandable-rows";

// A COA whose link is a direct image can be shown as the actual document; a link to a lab's
// verify page opens there instead.
function isImageDoc(url: string): boolean {
  return /\.(png|webp|jpe?g)(\?|$)/i.test(url);
}

// Human labels for the non-purity analysis categories. Purity is the default and needs no label;
// the safety categories (sterility / endotoxin / heavy-metals) prove something a purity test does
// not, so they're worth calling out on the row.
const TEST_TYPE_LABEL: Record<string, string> = {
  sterility: "Sterility", endotoxin: "Endotoxin", "heavy-metals": "Heavy metals",
  dimer: "Dimer/aggregation", blend: "Blend", screening: "ID screen", identity: "Identity",
};
const SAFETY_TYPES = new Set(["sterility", "endotoxin", "heavy-metals"]);

// Surfaces real independent lab-test records (COAs). Purity, when present, was read from
// the certificate image. This is evidence about a specific tested batch, never a claim
// that every vial matches or an endorsement of the vendor.
// Long test histories are bounded: the first rows always show, the rest sit behind one expander.
const PREVIEW_ROWS = 8;

const INTRO = "Real, publicly verifiable third-party tests. Purity is read from the certificate itself. A test reflects one lab’s result for one submitted batch — not a guarantee that every vial matches.";

// The kit chip carries no tooltip, and every status on a row has one; the wrapper holds it.
// `block` puts the tag on its own line under the cell's text.
function Tag({ title, tone, icon, plain, block = false, children }: { title?: string; tone: Tone; icon?: ComponentType<{ className?: string }>; plain?: boolean; block?: boolean; children: ReactNode }) {
  return <span title={title} className={block ? "mt-1.5 flex w-fit" : "inline-flex"}><Chip tone={tone} icon={icon} plain={plain}>{children}</Chip></span>;
}

export function LabTestsPanel({ tests, heading = "Independent lab tests", id, number, children }: {
  tests: LabTestRow[];
  heading?: string;
  id?: string;
  /** With `id`, render as the page's numbered section frame (the compound page) instead of a standalone section. */
  number?: number;
  /** Further batch evidence that belongs in the same frame (the compound page's batch records). */
  children?: ReactNode;
}) {
  if (tests.length === 0 && children == null) return null;
  // Headline stats reflect INDEPENDENT evidence only — a vendor's self-published purity never
  // becomes the top-line number, though its row still shows below (labeled).
  const independentTests = tests.filter((t) => t.is_independent !== false);
  const withPurity = independentTests.filter((t) => t.purity_pct != null);
  const blindCount = independentTests.filter((t) => t.is_blind).length;
  const framed = Boolean(id && number != null);

  const renderRow = (t: LabTestRow) => {
    const isImg = isImageDoc(t.verify_url);
    return (
      <tr key={t.verify_url}>
        <td className="px-5 py-3">
          {isImg
            ? (
              <a href={t.verify_url} target="_blank" rel="noopener noreferrer" className="block size-12 overflow-hidden rounded-lg border border-[#111214]/15 bg-[#fbfbf8]" title="Open the full certificate">
                {/* eslint-disable-next-line @next/next/no-img-element -- COAs live on arbitrary vendor/lab hosts; next/image can't allowlist them */}
                <img src={t.verify_url} alt="Certificate of analysis" loading="lazy" className="size-full object-cover" />
              </a>
            )
            : <span className="grid size-12 place-items-center rounded-lg border border-[#111214]/15 bg-[#fbfbf8] text-[#4a4d56]"><FileText className="size-5" aria-hidden="true" /></span>}
        </td>
        <td className="px-5 py-3">
          <span className="font-extrabold text-[#111214]">{t.manufacturer}</span>
          {(t.is_blind || (t.test_type && t.test_type !== "purity")) && (
            <span className="mt-1 flex flex-wrap items-center gap-1">
              {t.is_blind && (
                <Tag title="Blind test — the sample was obtained independently, so the vendor could not choose which vial was tested. The gold standard." tone="mint" icon={EyeOff}>Blind</Tag>
              )}
              {t.test_type && t.test_type !== "purity" && TEST_TYPE_LABEL[t.test_type] && (
                SAFETY_TYPES.has(t.test_type)
                  ? <Tag title="A safety test — distinct from a purity test. Proves this specific check, not overall purity." tone="blue" icon={ShieldCheck}>{TEST_TYPE_LABEL[t.test_type]}</Tag>
                  : <Tag title="Analysis type as labeled by the lab." tone="paper">{TEST_TYPE_LABEL[t.test_type]}</Tag>
              )}
            </span>
          )}
        </td>
        <td className="px-5 py-3 font-mono text-xs text-[var(--muted)]">{t.batch_code || "—"}</td>
        <td className="px-5 py-3">
          {t.purity_pct != null
            ? <Chip tone="mint" plain className="tabular-nums">{Number(t.purity_pct).toFixed(2)}%</Chip>
            : <span className="text-xs text-[var(--muted)]">See report</span>}
        </td>
        <td className="px-5 py-3 text-xs tabular-nums">
          {(() => {
            const c = checkContent(t.sample_name, t.measured_content);
            if (!c.verdict) return <span className="text-[var(--muted)]">{t.measured_content || "—"}</span>;
            return <Tag title={c.note ?? undefined} tone={c.verdict === "underdosed" ? "danger" : "mint"} plain>{c.measuredMg}/{c.labeledMg}mg{c.verdict === "underdosed" ? " · underdosed" : c.verdict === "overfilled" ? " ·" : " · full"}</Tag>;
          })()}
        </td>
        <td className="px-5 py-3 text-xs">
          {t.is_independent === false
            ? (/self-published/i.test(t.lab)
                ? <Tag title="Published by the vendor with no independent third-party lab named. A vendor testing its own product is far weaker than an independent lab — shown for transparency, but it does not count toward independent corroboration." tone="warn" icon={AlertTriangle}>Vendor self-tested</Tag>
                : <Tag title={`Names "${t.lab}", but we could not confirm it is a real, independent third-party lab (no accreditation, registry record, or independence from the vendor established). Shown for transparency; does not count toward independent corroboration.`} tone="warn" icon={AlertTriangle} plain>Unverified lab · {t.lab}</Tag>)
            : t.lab}
          {t.is_independent !== false && t.janoshik_checked_at != null && (t.janoshik_listed
            ? <Tag block title={`Still publicly listed in Janoshik's database as of ${new Date(t.janoshik_checked_at).toLocaleDateString()}${t.janoshik_made_by ? ` — listed maker: ${t.janoshik_made_by}` : ""}. This confirms the certificate remains public; it is the same source as our record, not a second opinion.`} tone="mint" icon={BadgeCheck}>Still listed</Tag>
            : <Tag block title={`Not found in Janoshik's public feed when re-checked ${new Date(t.janoshik_checked_at).toLocaleDateString()} — it may have rotated out of the public list, or been pulled.`} tone="warn">Not in current feed</Tag>)}
        </td>
        <td className="px-5 py-3">
          <a href={t.verify_url} target="_blank" rel="noopener nofollow" className={UI.linkSmall}>
            <FlaskConical className="size-3.5" aria-hidden="true" /> {isImg ? "View" : "Verify"} <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        </td>
      </tr>
    );
  };

  const body = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <details className="group max-w-2xl">
            <summary className={UI.linkSmall + " cursor-pointer list-none [&::-webkit-details-marker]:hidden"}>
              <FileText className="size-3.5" aria-hidden="true" /> How does this data get here?
            </summary>
            <Quiet className="mt-2 text-xs font-medium leading-6 text-[#3a3d46]">
              <p>Every record below is a real certificate of analysis, gathered two ways: from the public verification feeds that independent labs (like Janoshik) publish, and from the certificates vendors post on their own product pages. We open each certificate <span className="font-extrabold text-[#111214]">document</span> and read the measured purity, content, batch, and date directly off it — a scraper can&rsquo;t read a number printed inside an image, so this is done by machine vision, then recorded here with a link back to the original.</p>
              <p className="mt-2">Nothing here is typed in by a vendor or invented by us. Where a certificate is missing, we say so rather than filling the gap.</p>
              <p className="mt-2"><span className="font-extrabold text-[#111214]">We re-check the lab feed, too.</span> A &ldquo;still listed&rdquo; tag means the certificate is <em>currently</em> public in Janoshik&rsquo;s database — we re-verify against the live feed and stamp the date. If a cert is later pulled, the tag flips. It&rsquo;s a freshness check on the same source, not a second independent opinion.</p>
            </Quiet>
          </details>
          <details className="group max-w-2xl">
            <summary className={UI.linkSmall + " cursor-pointer list-none [&::-webkit-details-marker]:hidden"}>
              <FlaskConical className="size-3.5" aria-hidden="true" /> What a certificate does &amp; doesn&rsquo;t prove
            </summary>
            <Quiet className="mt-2 text-xs font-medium leading-6 text-[#3a3d46]">
              <p><span className="font-extrabold text-[#111214]">Three different questions.</span> Purity (&ldquo;how clean?&rdquo;), identity (&ldquo;is it the right molecule?&rdquo;, a mass-spec test), and content (&ldquo;did I get the labeled mg?&rdquo;) are separate. A vial can be 99% pure and still be the wrong peptide, or the right peptide underdosed. We flag the measured dose against the label above; underdosing is the most common real fraud.</p>
              <p className="mt-2"><span className="font-extrabold text-[#111214]">Who submitted the sample matters.</span> Most of these are <em>vendor-submitted</em> — the seller chose which vial to send, so one good certificate doesn&rsquo;t prove every batch is the same. The gold standard is a <em>blind</em> test, where a buyer sends a vial they bought as a normal customer. Same label doesn&rsquo;t prove same product; same batch number doesn&rsquo;t prove same batch.</p>
            </Quiet>
          </details>
        </div>
        {(blindCount > 0 || withPurity.length > 0) && (
          <div className="flex flex-wrap gap-3">
            {blindCount > 0 && (
              <div title="Blind tests: the sample was obtained independently, so the vendor could not hand-pick which vial was tested. This is the strongest independence signal a certificate can carry.">
                <Stat tone="blue" icon={EyeOff} value={blindCount} label={`blind ${blindCount === 1 ? "test" : "tests"}`} className="min-w-36" />
              </div>
            )}
            {withPurity.length > 0 && (
              <Stat tone="mint" value={`${Math.max(...withPurity.map((t) => Number(t.purity_pct))).toFixed(1)}%`} label="highest tested purity" className="min-w-36" />
            )}
          </div>
        )}
      </div>
      {tests.length > 0 && (
        <div className={(framed ? "ink-1 rounded-[14px]" : "ink hard-sm rounded-[16px]") + " overflow-x-auto bg-white"}>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#fbfbf8]">
              <tr>
                <th className={"px-5 py-3 " + UI.eyebrowMuted}>Certificate</th>
                <th className={"px-5 py-3 " + UI.eyebrowMuted}>Manufacturer</th>
                <th className={"px-5 py-3 " + UI.eyebrowMuted}>Batch</th>
                <th className={"px-5 py-3 " + UI.eyebrowMuted}>Purity</th>
                <th className={"px-5 py-3 " + UI.eyebrowMuted}>Content / dose</th>
                <th className={"px-5 py-3 " + UI.eyebrowMuted}>Lab</th>
                <th className={"px-5 py-3 " + UI.eyebrowMuted}></th>
              </tr>
            </thead>
            <ExpandableRows
              colSpan={7}
              restCount={tests.length - PREVIEW_ROWS}
              label={`Show all ${tests.length} test records`}
              bodyClassName="divide-y divide-[#111214]/10"
              preview={tests.slice(0, PREVIEW_ROWS).map(renderRow)}
              rest={tests.slice(PREVIEW_ROWS).map(renderRow)}
            />
          </table>
        </div>
      )}
      {children}
    </>
  );

  if (framed) {
    return (
      <NumberedSection id={id!} number={number!} eyebrow="Independent testing" title={heading} intro={INTRO}>
        {body}
      </NumberedSection>
    );
  }
  return (
    <section id={id} className={UI.container + " scroll-mt-[140px] py-8"}>
      <SectionHeading eyebrow="Independent testing" title={heading} lead={INTRO} />
      <div className="mt-6 space-y-4">{body}</div>
    </section>
  );
}
