import { requireStaff } from "@/server/auth/session";
import {
  getEvidenceLearningSummary,
  listVerifiedDiscrepancies,
} from "@/server/intelligence/learning-trajectories";

export const dynamic = "force-dynamic";
export const metadata = { title: "Learning" };

function show(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function LearningPage() {
  await requireStaff();

  const [summary, discrepancies] = await Promise.all([
    getEvidenceLearningSummary(),
    listVerifiedDiscrepancies(20),
  ]);

  const decided = summary.totals.accepted + summary.totals.rejected;

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2b31d8]">Learning loop</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">Where the system disagreed with reality.</h1>
      <p className="mt-4 max-w-[72ch] text-[15px] leading-7 text-[var(--muted)]">
        This page turns the evidence pipeline into trajectory data: source snapshot → extraction run → proposed claim →
        review decision → publication or rejection. A rejection means the proposed system state was rejected by the
        review authority. It does not, by itself, mean the source or vendor was false.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        {[
          ["Claims observed", summary.totals.total],
          ["Accepted", summary.totals.accepted],
          ["Rejected proposals", summary.totals.rejected],
          ["Still waiting", summary.totals.pending],
        ].map(([label, value]) => (
          <div key={String(label)} className="ink hard rounded-[16px] bg-white p-5">
            <p className="text-2xl font-extrabold tabular-nums">{Number(value).toLocaleString()}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[.08em] text-[var(--muted)]">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="ink hard rounded-[18px] bg-white p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#2b31d8]">By field</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-.03em]">What gets corrected most.</h2>
            </div>
            <span className="text-xs font-semibold text-[var(--muted)]">
              {decided ? String(summary.totals.rejectionRatePct) + "% rejected overall" : "No decisions yet"}
            </span>
          </div>

          <div className="mt-5 grid gap-2">
            {summary.byPredicate.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No evidence claims have been reviewed yet.</p>
            ) : summary.byPredicate.map((row) => (
              <div key={row.predicate} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-black/8 py-2 text-sm last:border-b-0">
                <span className="font-mono font-bold">{row.predicate}</span>
                <span className="text-xs text-[var(--muted)]">{row.rejected}/{row.accepted + row.rejected} rejected</span>
                <span className="font-extrabold tabular-nums">{row.rejectionRatePct}%</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ink hard rounded-[18px] bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#2b31d8]">By workflow</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-[-.03em]">Which extraction paths need work.</h2>
          <div className="mt-5 grid gap-2">
            {summary.byWorkflow.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No extraction runs have produced reviewable claims yet.</p>
            ) : summary.byWorkflow.map((row) => (
              <div key={row.workflow} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-black/8 py-2 text-sm last:border-b-0">
                <span className="font-mono font-bold">{row.workflow}</span>
                <span className="text-xs text-[var(--muted)]">{row.rejected}/{row.accepted + row.rejected} rejected</span>
                <span className="font-extrabold tabular-nums">{row.rejectionRatePct}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#2b31d8]">Verified discrepancies</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-.04em]">Recent rejected proposals.</h2>
          </div>
          <p className="max-w-[60ch] text-right text-xs leading-5 text-[var(--muted)]">
            These are reusable negative examples because the proposed state, source, model confidence, and review consequence are connected.
          </p>
        </div>

        <div className="mt-4 grid gap-4">
          {discrepancies.length === 0 ? (
            <div className="ink hard rounded-[18px] bg-white p-7 text-sm text-[var(--muted)]">
              No rejected proposals yet. Once reviewers reject claims, they will appear here as trajectory-backed learning examples.
            </div>
          ) : discrepancies.map((item) => (
            <article key={item.claimId} className="ink hard rounded-[18px] bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="ink-1 rounded-full bg-[#fff3e0] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#8a5500]">
                      rejected proposal
                    </span>
                    <span className="font-mono text-sm font-extrabold">{item.proposal.predicate}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{item.source.label}</p>
                  <p className="mt-1 break-all text-xs text-[var(--muted)]">{item.source.location}</p>
                </div>
                <div className="text-right text-xs text-[var(--muted)]">
                  <div>{when(item.review?.createdAt ?? item.proposal.createdAt)}</div>
                  <div className="mt-1 tabular-nums">{Math.round(item.proposal.modelConfidence * 100)}% model confidence</div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[12px] bg-[#f7f7f4] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]">Before</p>
                  <p className="mt-2 font-mono text-sm">{show(item.proposal.previousValue)}</p>
                </div>
                <div className="rounded-[12px] bg-[#fff3e0] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8a5500]">Proposed</p>
                  <p className="mt-2 font-mono text-sm">{show(item.proposal.proposedValue)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                <p><span className="font-extrabold">Why the extractor proposed it:</span> {item.proposal.rationale}</p>
                <p><span className="font-extrabold">Why review rejected it:</span> {item.review?.notes || item.review?.reasonCode || "No note recorded"}</p>
                <p className="text-xs text-[var(--muted)]">
                  Workflow <span className="font-mono">{item.proposal.workflow}</span> · extractor <span className="font-mono">{item.proposal.extractorVersion}</span> · snapshot <span className="font-mono">{item.source.snapshotId}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
