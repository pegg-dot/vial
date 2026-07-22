import { ExternalLink, FileText, FlaskConical, BadgeCheck } from "lucide-react";
import type { LabTestRow } from "@/server/ingest/lab-tests";
import { checkContent } from "@/server/verify/content-check";

// A COA whose link is a direct image can be shown as the actual document; a link to a lab's
// verify page opens there instead.
function isImageDoc(url: string): boolean {
  return /\.(png|webp|jpe?g)(\?|$)/i.test(url);
}

// Surfaces real independent lab-test records (COAs). Purity, when present, was read from
// the certificate image. This is evidence about a specific tested batch, never a claim
// that every vial matches or an endorsement of the vendor.
export function LabTestsPanel({ tests, heading = "Independent lab tests" }: { tests: LabTestRow[]; heading?: string }) {
  if (tests.length === 0) return null;
  const withPurity = tests.filter((t) => t.purity_pct != null);
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Independent testing</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">{heading}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Real, publicly verifiable third-party tests. Purity is read from the certificate itself. A test reflects one lab&rsquo;s result for one submitted batch — not a guarantee that every vial matches.
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            <details className="group max-w-2xl">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-violet-700 [&::-webkit-details-marker]:hidden">
                <FileText className="size-3.5" /> How does this data get here?
              </summary>
              <div className="mt-2 rounded-2xl border border-black/[.07] bg-white p-4 text-xs leading-6 text-black/65">
                <p>Every record below is a real certificate of analysis, gathered two ways: from the public verification feeds that independent labs (like Janoshik) publish, and from the certificates vendors post on their own product pages. We open each certificate <span className="font-semibold text-black/75">document</span> and read the measured purity, content, batch, and date directly off it — a scraper can&rsquo;t read a number printed inside an image, so this is done by machine vision, then recorded here with a link back to the original.</p>
                <p className="mt-2">Nothing here is typed in by a vendor or invented by us. Where a certificate is missing, we say so rather than filling the gap.</p>
                <p className="mt-2"><span className="font-semibold text-black/75">We re-check the lab feed, too.</span> A &ldquo;still listed&rdquo; tag means the certificate is <em>currently</em> public in Janoshik&rsquo;s database — we re-verify against the live feed and stamp the date. If a cert is later pulled, the tag flips. It&rsquo;s a freshness check on the same source, not a second independent opinion.</p>
              </div>
            </details>
            <details className="group max-w-2xl">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-violet-700 [&::-webkit-details-marker]:hidden">
                <FlaskConical className="size-3.5" /> What a certificate does &amp; doesn&rsquo;t prove
              </summary>
              <div className="mt-2 rounded-2xl border border-black/[.07] bg-white p-4 text-xs leading-6 text-black/65">
                <p><span className="font-semibold text-black/75">Three different questions.</span> Purity (&ldquo;how clean?&rdquo;), identity (&ldquo;is it the right molecule?&rdquo;, a mass-spec test), and content (&ldquo;did I get the labeled mg?&rdquo;) are separate. A vial can be 99% pure and still be the wrong peptide, or the right peptide underdosed. We flag the measured dose against the label above; underdosing is the most common real fraud.</p>
                <p className="mt-2"><span className="font-semibold text-black/75">Who submitted the sample matters.</span> Most of these are <em>vendor-submitted</em> — the seller chose which vial to send, so one good certificate doesn&rsquo;t prove every batch is the same. The gold standard is a <em>blind</em> test, where a buyer sends a vial they bought as a normal customer. Same label doesn&rsquo;t prove same product; same batch number doesn&rsquo;t prove same batch.</p>
              </div>
            </details>
          </div>
        </div>
        {withPurity.length > 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
            <p className="text-2xl font-semibold tabular-nums text-emerald-800">{Math.max(...withPurity.map((t) => Number(t.purity_pct))).toFixed(1)}%</p>
            <p className="text-[11px] font-semibold text-emerald-700">highest tested purity</p>
          </div>
        )}
      </div>
      <div className="overflow-x-auto rounded-[24px] border border-black/[.07] bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-black/[.025] text-[10px] uppercase tracking-[.12em] text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">Certificate</th>
              <th className="px-5 py-3 font-medium">Manufacturer</th>
              <th className="px-5 py-3 font-medium">Batch</th>
              <th className="px-5 py-3 font-medium">Purity</th>
              <th className="px-5 py-3 font-medium">Content / dose</th>
              <th className="px-5 py-3 font-medium">Lab</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[.06]">
            {tests.map((t) => {
              const isImg = isImageDoc(t.verify_url);
              return (
                <tr key={t.verify_url}>
                  <td className="px-5 py-3">
                    {isImg
                      ? (
                        <a href={t.verify_url} target="_blank" rel="noopener noreferrer" className="block size-12 overflow-hidden rounded-lg border border-black/[.1] bg-black/[.02]" title="Open the full certificate">
                          {/* eslint-disable-next-line @next/next/no-img-element -- COAs live on arbitrary vendor/lab hosts; next/image can't allowlist them */}
                          <img src={t.verify_url} alt="Certificate of analysis" loading="lazy" className="size-full object-cover" />
                        </a>
                      )
                      : <span className="grid size-12 place-items-center rounded-lg border border-black/[.08] bg-black/[.02] text-black/30"><FileText className="size-5" /></span>}
                  </td>
                  <td className="px-5 py-3 font-semibold">{t.manufacturer}</td>
                  <td className="px-5 py-3 font-mono text-xs text-[var(--muted)]">{t.batch_code || "—"}</td>
                  <td className="px-5 py-3">
                    {t.purity_pct != null
                      ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 tabular-nums">{Number(t.purity_pct).toFixed(2)}%</span>
                      : <span className="text-xs text-[var(--muted)]">See report</span>}
                  </td>
                  <td className="px-5 py-3 text-xs tabular-nums">
                    {(() => {
                      const c = checkContent(t.sample_name, t.measured_content);
                      if (!c.verdict) return <span className="text-[var(--muted)]">{t.measured_content || "—"}</span>;
                      const style = c.verdict === "underdosed" ? "bg-rose-100 text-rose-800" : "bg-emerald-50 text-emerald-800";
                      return <span title={c.note ?? undefined} className={`inline-flex items-center rounded-full px-2 py-1 font-semibold ${style}`}>{c.measuredMg}/{c.labeledMg}mg{c.verdict === "underdosed" ? " · underdosed" : c.verdict === "overfilled" ? " ·" : " · full"}</span>;
                    })()}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {t.lab}
                    {t.janoshik_checked_at != null && (t.janoshik_listed
                      ? <span title={`Still publicly listed in Janoshik's database as of ${new Date(t.janoshik_checked_at).toLocaleDateString()}${t.janoshik_made_by ? ` — listed maker: ${t.janoshik_made_by}` : ""}. This confirms the certificate remains public; it is the same source as our record, not a second opinion.`} className="mt-1.5 flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><BadgeCheck className="size-3" /> Still listed</span>
                      : <span title={`Not found in Janoshik's public feed when re-checked ${new Date(t.janoshik_checked_at).toLocaleDateString()} — it may have rotated out of the public list, or been pulled.`} className="mt-1.5 flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Not in current feed</span>)}
                  </td>
                  <td className="px-5 py-3">
                    <a href={t.verify_url} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline">
                      <FlaskConical className="size-3" /> {isImg ? "View" : "Verify"} <ExternalLink className="size-3" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
