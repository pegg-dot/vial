import Link from "next/link";
import { requireStaff } from "@/server/auth/session";
import { getPublicationRecords, type PublicationRecord } from "@/server/review/repository";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publication ledger" };

// Step three, and the reason the other two are worth having.
//
// AGENTS.md: "every approved mutation must create a publication receipt in the same transaction."
// This is that receipt, made readable. Each row is a version of a listing, what it was, what it
// became, who decided, and which claims carried it — so any number on the public site can be walked
// backwards to the snapshot it came from.

const show = (v: unknown) => v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

/** Only the fields that actually moved. A receipt listing unchanged columns hides the change. */
function changed(record: PublicationRecord): { key: string; before: unknown; after: unknown }[] {
  const keys = new Set([...Object.keys(record.before ?? {}), ...Object.keys(record.after ?? {})]);
  return [...keys]
    .map((key) => ({ key, before: record.before?.[key], after: record.after?.[key] }))
    .filter((f) => JSON.stringify(f.before) !== JSON.stringify(f.after));
}

export default async function PublicationsPage({ searchParams }: { searchParams: Promise<{ published?: string }> }) {
  await requireStaff();
  const { published } = await searchParams;
  const records = await getPublicationRecords(100);

  return (
    <div className="mx-auto max-w-[900px] px-5 py-10 sm:px-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2b31d8]">Provenance</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">Publication ledger</h1>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-[var(--muted)]">
        Every value a buyer sees arrived through one of these. Each is a receipt written in the same transaction
        as the change itself, so a published figure can always be walked back to the source it came from.
      </p>

      {published ? (
        <p className="ink-1 mt-6 rounded-[12px] bg-[#e6fbf4] px-4 py-3 text-sm font-semibold text-[#0e8f80]">
          The claim was published and is live on the listing now.
        </p>
      ) : null}

      <div className="mt-8 grid gap-5">
        {records.length === 0 ? (
          <div className="ink hard rounded-[18px] bg-white p-8">
            <p className="text-lg font-extrabold">Nothing published yet.</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              <Link href="/admin/ingest" className="font-bold text-[#2b31d8]">Capture a source</Link>, approve what it
              proposes, and the receipt appears here.
            </p>
          </div>
        ) : records.map((record) => (
          <article key={record.id} data-listing-slug={record.listingSlug} className="ink hard rounded-[18px] bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-lg font-extrabold tracking-[-.02em]">{record.vendorName} — {record.productName}</p>
              <span className="ink-1 rounded-full bg-[#eef0ff] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#2b31d8]">
                Version {record.version}
              </span>
            </div>

            <div className="mt-4 grid gap-2">
              {changed(record).map((field) => (
                <div key={field.key} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="min-w-[7rem] text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{field.key}</span>
                  <span className="ink-1 rounded-[10px] bg-[#f7f7f4] px-3 py-1.5 font-semibold tabular-nums text-[var(--muted)] line-through">{show(field.before)}</span>
                  <span aria-hidden className="font-bold text-[var(--muted)]">→</span>
                  <span className="ink-1 rounded-[10px] bg-[#eef0ff] px-3 py-1.5 font-extrabold tabular-nums text-[#2b31d8]">{show(field.after)}</span>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs font-semibold text-[var(--muted)]">
              Published by {record.publishedBy} · {new Date(record.publishedAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              {record.publishedClaimIds.length ? ` · ${record.publishedClaimIds.length} claim${record.publishedClaimIds.length === 1 ? "" : "s"}` : ""}
            </p>

            <Link href={`/products/${record.listingSlug}`} className="mt-3 inline-block text-sm font-bold text-[#2b31d8]">
              See it on the listing →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
