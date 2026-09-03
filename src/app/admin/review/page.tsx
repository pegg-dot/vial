import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireStaff } from "@/server/auth/session";
import { getPendingClaims, type ReviewClaim } from "@/server/review/repository";
import { reviewQueueAction } from "../provenance-actions";
import { SelectAllClaims } from "@/components/admin/select-all-claims";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue" };

// Step two. The human gate that AGENTS.md calls the central guarantee: "every changed observed
// value must enter the review queue", and nothing published without a decision recorded against it.
//
// Every claim shows what it would change FROM and TO, how confident the extractor was, and the
// exact source excerpt it came from — because approving is asserting the new value to buyers, and
// nobody should have to take the extractor's word for it. The whole queue is ONE form: tick the
// checkboxes and decide a batch in one gesture, or use a card's own buttons for just that card.
// Bulk approval is a loop over the same per-claim transaction — one receipt per claim, always.

const RISK_TONE: Record<string, string> = {
  standard: "bg-[#e6fbf4] text-[#0e8f80]",
  material: "bg-[#fff3e0] text-[#b26a00]",
  "high-impact": "bg-[#ffecea] text-[#d3372c]",
};

const show = (v: unknown) => v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

const isHttp = (v: string) => /^https?:\/\//i.test(v);

function Claim({ claim }: { claim: ReviewClaim }) {
  return (
    <article data-claim-predicate={claim.predicate} data-claim-id={claim.id} className="ink hard rounded-[18px] bg-white p-6">
      <div className="flex flex-wrap items-center gap-2">
        <label className="mr-1 flex cursor-pointer items-center gap-2 text-xs font-bold" title="Select for a bulk decision">
          <input type="checkbox" name="selected" value={claim.id} className="size-4.5 accent-[#2b31d8]" />
          Select
        </label>
        <span className="ink-1 rounded-full bg-[#eef0ff] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#2b31d8]">{claim.predicate}</span>
        <span className={`ink-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${RISK_TONE[claim.riskLevel] ?? RISK_TONE.standard}`}>{claim.riskLevel}</span>
        <span className="text-xs font-semibold text-[var(--muted)] tabular-nums">{Math.round(claim.confidence * 100)}% confidence</span>
      </div>

      {/* The claim names a real listing — link to it, so a reviewer can see the page a buyer
          would see before asserting a new value onto it. */}
      <p className="mt-4 text-lg font-extrabold tracking-[-.02em]">
        <Link href={`/products/${claim.listingSlug}`} target="_blank" className="hover:underline hover:decoration-black/25 hover:underline-offset-4">
          {claim.vendorName} — {claim.productName}
        </Link>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-3 text-xs font-bold">
        <Link href={`/products/${claim.listingSlug}`} target="_blank" className="inline-flex items-center gap-1 text-[#2b31d8] hover:underline">
          View the listing <ExternalLink className="size-3" />
        </Link>
        {isHttp(claim.sourceLocation) && (
          <a href={claim.sourceLocation} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#2b31d8] hover:underline">
            Vendor&rsquo;s page <ExternalLink className="size-3" />
          </a>
        )}
      </p>

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
        <button type="submit" name="approveOne" value={claim.id} className="ink hard-sm press rounded-full bg-[#2b31d8] px-5 py-2.5 text-sm font-extrabold text-white">
          Approve and publish
        </button>
        <button type="submit" name="rejectOne" value={claim.id} className="ink-1 rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#111214]">
          Reject
        </button>
      </div>
    </article>
  );
}

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ proposed?: string; duplicate?: string; rejected?: string; published?: string; declined?: string; error?: string }> }) {
  await requireStaff();
  const { proposed, duplicate, rejected, published, declined, error } = await searchParams;
  const claims = await getPendingClaims(100);
  const count = Number(proposed ?? Number.NaN);
  const publishedCount = Number(published ?? Number.NaN);
  const declinedCount = Number(declined ?? Number.NaN);

  return (
    <div className="mx-auto max-w-[900px] px-5 py-10 sm:px-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2b31d8]">Provenance</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">Review queue</h1>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-[var(--muted)]">
        Nothing here has reached a buyer. Approving one writes the new value and a publication receipt in the
        same transaction; rejecting records the decision and changes nothing. Tick checkboxes to decide a
        batch at once — a bulk approval still writes one receipt per claim.
      </p>

      {error ? (
        <p role="alert" className="ink-1 mt-6 rounded-[12px] bg-[#ffecea] px-4 py-3 text-sm font-semibold text-[#d3372c]">{error}</p>
      ) : null}

      {Number.isFinite(publishedCount) && publishedCount > 0 ? (
        <p className="ink-1 mt-6 rounded-[12px] bg-[#e6fbf4] px-4 py-3 text-sm font-semibold text-[#0e8f80]">
          Published {publishedCount} claim{publishedCount === 1 ? "" : "s"} — each with its own receipt. <Link href="/admin/publications" className="underline">See the receipts →</Link>
        </p>
      ) : null}

      {Number.isFinite(declinedCount) && declinedCount > 0 ? (
        <p className="ink-1 mt-6 rounded-[12px] bg-[#f7f7f4] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
          Rejected {declinedCount} claim{declinedCount === 1 ? "" : "s"}. Decisions recorded; nothing was published.
        </p>
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

      {claims.length === 0 ? (
        <div className="ink hard mt-8 rounded-[18px] bg-white p-8">
          <p className="text-lg font-extrabold">Nothing waiting.</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            An empty queue means every observed change has been decided — not that nothing is being watched.{" "}
            <Link href="/admin/ingest" className="font-bold text-[#2b31d8]">Capture a source</Link> to put something in it.
          </p>
        </div>
      ) : (
        <form action={reviewQueueAction}>
          {claims.length > 1 && (
            <div className="ink hard sticky top-[84px] z-20 mt-8 flex flex-wrap items-center gap-4 rounded-[16px] bg-[#f0edff] px-5 py-3.5">
              <SelectAllClaims />
              <span className="text-xs font-semibold text-[var(--muted)]">{claims.length} waiting</span>
              <div className="ml-auto flex flex-wrap items-center gap-2.5">
                <button type="submit" name="bulk" value="approve" className="ink hard-sm press rounded-full bg-[#2b31d8] px-4 py-2 text-sm font-extrabold text-white">
                  Approve selected
                </button>
                <button type="submit" name="bulk" value="reject" className="ink-1 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-[#111214]">
                  Reject selected
                </button>
              </div>
            </div>
          )}
          <div className="mt-5 grid gap-5">
            {claims.map((claim) => <Claim key={claim.id} claim={claim} />)}
          </div>
        </form>
      )}
    </div>
  );
}
