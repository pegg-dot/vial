import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireStaff } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import { captureAndExtractAction } from "../provenance-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Capture a source" };

// Step one of snapshot → review → publish.
//
// Nothing about this pipeline was broken: runSourceIngestion has always captured an immutable
// snapshot, diffed it against the last one, and proposed claims. What was missing was any way to
// hand it a source. 552 sources were registered and had produced zero snapshots because commit
// 298e7ce removed this page along with the rest of the operator surface.
//
// The capture is deliberately manual paste rather than a fetch-by-URL. Source content is hostile
// data and the refresh path has an allowlist for a reason; a staff member pasting what they are
// looking at cannot be talked into fetching an internal address.

interface ListingOption { slug: string; label: string }

async function listings(): Promise<ListingOption[]> {
  const db = await getDatabase();
  const { rows } = await db.query<{ slug: string; product_name: string; vendor_name: string }>(
    `SELECT l.slug, p.name AS product_name, o.display_name AS vendor_name
       FROM listings l
       JOIN products p ON p.id = l.product_id
       JOIN organizations o ON o.id = p.vendor_id
      ORDER BY o.display_name, p.name
      LIMIT 400`,
  );
  return rows.map((r) => ({ slug: r.slug, label: `${r.vendor_name} — ${r.product_name}` }));
}

export default async function IngestPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff();
  const { error } = await searchParams;
  const options = await listings();

  return (
    <div className="mx-auto max-w-[900px] px-5 py-10 sm:px-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2b31d8]">Provenance</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">Capture a source.</h1>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-[var(--muted)]">
        Paste what a source actually said. VialGrade stores it as an immutable snapshot, diffs it against the
        last capture, and proposes claims for review — nothing reaches a buyer until someone approves it.
      </p>

      {error ? (
        <p role="alert" className="ink-1 mt-6 rounded-[12px] bg-[#ffecea] px-4 py-3 text-sm font-semibold text-[#d3372c]">
          {error === "missing" ? "Every field is required — nothing was captured." : error}
        </p>
      ) : null}

      <form action={captureAndExtractAction} className="ink hard mt-8 rounded-[20px] bg-white p-6">
        <div className="grid gap-5">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Target listing</span>
            <select name="targetListingSlug" required defaultValue="" className="field">
              <option value="" disabled>Choose the listing this source describes…</option>
              {options.map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Canonical URL</span>
            <input name="canonicalLocation" type="url" required placeholder="https://vendor.example/product/bpc-157" className="field" />
            <span className="text-xs text-[var(--muted)]">Where this content came from. Stored with the snapshot so any claim traces back to it.</span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Source label</span>
            <input name="label" type="text" required minLength={3} maxLength={160} placeholder="Vendor product page, captured manually" className="field" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Captured content</span>
            <textarea name="rawContent" required minLength={20} rows={12} placeholder="Paste the page source or visible text exactly as it appeared." className="field font-mono text-[13px]" />
            <span className="text-xs text-[var(--muted)]">Kept verbatim. The extractor reads it; it never decides anything on its own.</span>
          </label>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button type="submit" className="ink hard-sm press rounded-full bg-[#2b31d8] px-6 py-3 text-sm font-extrabold text-white">
            Capture and extract
          </button>
          <Link href="/admin/review" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#2b31d8]">
            Go to the review queue <ArrowRight className="size-4" />
          </Link>
        </div>
      </form>
    </div>
  );
}
