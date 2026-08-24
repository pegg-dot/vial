import Link from "next/link";
import { requireStaff } from "@/server/auth/session";
import { getPendingClaims, type ReviewClaim } from "@/server/review/repository";
import { reviewClaimAction } from "../provenance-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue" };

// Step two. The human gate that AGENTS.md calls the central guarantee: "every changed observed
// value must enter the review queue", and nothing published without a decision recorded against it.
//
// Every claim shows what it would change FROM and TO, how confident the extractor was, and the
// exact source excerpt it came from — because approving is asserting the new value to buyers, and
// nobody should have to take the extractor's word for it.

const RISK_TONE: Record<string, string> = {
  standard: "bg-[#e6fbf4] text-[#0e8f80]",
  material: "bg-[#fff3e0] text-[#b26a00]",
  "high-impact": "bg-[#ffecea] text-[#d3372c]",
};

const show = (v: unknown) => v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

function Claim({ claim }: { claim: ReviewClaim }) {
  return (
    <article data-claim-predicate={claim.predicate} data-claim-id={claim.id} className="ink hard rounded-[18px] bg-white p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="ink-1 rounded-full bg-[#eef0ff] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#2b31d8]">{claim.predicate}</span>
        <span className={`ink-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${RISK_TONE[claim.riskLevel] ?? RISK_TONE.standard}`}>{claim.riskLevel}</span>
        <span className="text-xs font-semibold text-[var(--muted)] tabular-nums">{Math.round(claim.confidence * 100)}% confidence</span>
      </div>

      <p className="mt-4 text-lg font-extrabold tracking-[-.02em]">{claim.vendorName} — {claim.productName}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="ink-1 rounded-[10px] bg-[#f7f7f4] px-3 py-1.5 font-semibold tabular-nums text-[var(--muted)] line-through">{show(claim.previousValue)}</span>
        <span aria-hidden className="font-bold text-[var(--muted)]">→</span>
        <span className="ink-1 rounded-[10px] bg-[#eef0ff] px-3 py-1.5 font-extrabold tabular-nums text-[#2b31d8]">{show(claim.proposedValue)}</span>
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{claim.rationale}</p>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-bold text-[#2b31d8]">What the source said</summary>
        <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
          {claim.sourceLabel} · <span className="font-mono">{claim.sourceLocation}</span>
        </p>
        <pre className="ink-1 mt-2 max-h-56 overflow-auto rounded-[10px] bg-[#f7f7f4] p-3 text-[12px] leading-5 whitespace-pre-wrap">{claim.sourceExcerpt || "(no excerpt captured)"}</pre>
      </details>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={reviewClaimAction}>
          <input type="hidden" name="claimId" value={claim.id} />
          <input type="hidden" name="decision" value="approve" />
          <button type="submit" className="ink hard-sm press rounded-full bg-[#2b31d8] px-5 py-2.5 text-sm font-extrabold text-white">
            Approve and publish
          </button>
        </form>
        <form action={reviewClaimAction}>
          <input type="hidden" name="claimId" value={claim.id} />
          <input type="hidden" name="decision" value="reject" />
          <button type="submit" className="ink-1 rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#111214]">
            Reject
          </button>
        </form>
      </div>
    </article>
  );
}

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ proposed?: string; duplicate?: string; rejected?: string; error?: string }> }) {
  await requireStaff();
  const { proposed, duplicate, rejected, error } = await searchParams;
  const claims = await getPendingClaims(100);
  const count = Number(proposed ?? Number.NaN);

  return (
    <div className="mx-auto max-w-[900px] px-5 py-10 sm:px-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2b31d8]">Provenance</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">Review queue</h1>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-[var(--muted)]">
        Nothing here has reached a buyer. Approving one writes the new value and a publication receipt in the
        same transaction; rejecting records the decision and changes nothing.
      </p>

      {error ? (
        <p role="alert" className="ink-1 mt-6 rounded-[12px] bg-[#ffecea] px-4 py-3 text-sm font-semibold text-[#d3372c]">{error}</p>
      ) : null}

      {Number.isFinite(count) ? (
        <p className="ink-1 mt-6 rounded-[12px] bg-[#eef0ff] px-4 py-3 text-sm font-semibold text-[#2b31d8]">
          {duplicate
            ? "That content was identical to the last capture, so no new snapshot was stored — this workflow proposed nothing to review."
            : `This workflow proposed ${count} claim${count === 1 ? "" : "s"} from the capture.`}
        </p>
      ) : null}

      {rejected ? (
        <p className="ink-1 mt-6 rounded-[12px] bg-[#f7f7f4] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
          Decision recorded. Nothing was published.
        </p>
      ) : null}

      <div className="mt-8 grid gap-5">
        {claims.length === 0 ? (
          <div className="ink hard rounded-[18px] bg-white p-8">
            <p className="text-lg font-extrabold">Nothing waiting.</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              An empty queue means every observed change has been decided — not that nothing is being watched.{" "}
              <Link href="/admin/ingest" className="font-bold text-[#2b31d8]">Capture a source</Link> to put something in it.
            </p>
          </div>
        ) : claims.map((claim) => <Claim key={claim.id} claim={claim} />)}
      </div>
    </div>
  );
}
