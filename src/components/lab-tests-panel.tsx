import { ExternalLink, FlaskConical } from "lucide-react";
import type { LabTestRow } from "@/server/ingest/lab-tests";

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
        </div>
        {withPurity.length > 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
            <p className="text-2xl font-semibold tabular-nums text-emerald-800">{Math.max(...withPurity.map((t) => Number(t.purity_pct))).toFixed(1)}%</p>
            <p className="text-[11px] font-semibold text-emerald-700">highest tested purity</p>
          </div>
        )}
      </div>
      <div className="overflow-x-auto rounded-[24px] border border-black/[.07] bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-black/[.025] text-[10px] uppercase tracking-[.12em] text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">Manufacturer</th>
              <th className="px-5 py-3 font-medium">Batch</th>
              <th className="px-5 py-3 font-medium">Purity</th>
              <th className="px-5 py-3 font-medium">Content</th>
              <th className="px-5 py-3 font-medium">Lab</th>
              <th className="px-5 py-3 font-medium">Verify</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[.06]">
            {tests.map((t) => (
              <tr key={t.verify_url}>
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
                    <FlaskConical className="size-3" /> Verify <ExternalLink className="size-3" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
