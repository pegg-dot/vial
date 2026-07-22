import { ExternalLink, FileText, FlaskConical } from "lucide-react";
import type { LabTestRow } from "@/server/ingest/lab-tests";

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
          <details className="group mt-3 max-w-2xl">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-violet-700 [&::-webkit-details-marker]:hidden">
              <FileText className="size-3.5" /> How does this data get here?
            </summary>
            <div className="mt-2 rounded-2xl border border-black/[.07] bg-white p-4 text-xs leading-6 text-black/65">
              <p>Every record below is a real certificate of analysis, gathered two ways: from the public verification feeds that independent labs (like Janoshik) publish, and from the certificates vendors post on their own product pages. We open each certificate <span className="font-semibold text-black/75">document</span> and read the measured HPLC purity, batch, and date directly off it — a scraper can&rsquo;t read a number printed inside an image, so this is done by machine vision, then recorded here with a link back to the original.</p>
              <p className="mt-2">Nothing here is typed in by a vendor or invented by us. Where a certificate is missing, we say so rather than filling the gap.</p>
            </div>
          </details>
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
              <th className="px-5 py-3 font-medium">Content</th>
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
                  <td className="px-5 py-3 text-xs text-[var(--muted)] tabular-nums">{t.measured_content || "—"}</td>
                  <td className="px-5 py-3 text-xs">{t.lab}</td>
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
