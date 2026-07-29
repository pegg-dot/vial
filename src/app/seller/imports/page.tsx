import { ArrowRight, Check, SearchCheck, TriangleAlert } from "lucide-react";
import { SellerPageHeader, Panel, StatusPill, primaryButton, secondaryButton } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import { getImportJob, getSellerContext } from "@/server/seller/ops";
import { acceptImportJobAction, confirmImportRowAction } from "../actions";

function record(value: unknown) {
  if (typeof value === "string") {
    try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; }
  }
  return (value as Record<string, unknown>) ?? {};
}

export default async function SellerImportsPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const principal = await requireSellerPermission("seller:catalog:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  const db = await getDatabase();
  const jobs = (await db.query(`SELECT * FROM seller_import_jobs WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 25`, [context.sellerId])).rows as Array<Record<string, unknown>>;
  const params = await searchParams;
  const selectedId = params.job || String(jobs[0]?.id ?? "");
  const selected = selectedId ? await getImportJob(selectedId, context.sellerId) : null;
  const compounds = (await db.query(`SELECT id,display_name FROM canonical_entities WHERE entity_type='compound' ORDER BY display_name`)).rows as Array<{ id: string; display_name: string }>;
  const job = selected?.job as Record<string, unknown> | undefined;
  const rows = (selected?.rows ?? []) as Array<Record<string, unknown>>;
  return <>
    <SellerPageHeader title="Import review" description="VIAL never silently publishes imported products. Every row is normalized, matched, scored, and held for seller confirmation." action={<a href="/seller/integrations" className={secondaryButton}>New import</a>} />
    <div className="mt-7 grid gap-6 xl:grid-cols-[.34fr_.66fr]">
      <Panel title="Import jobs" description={`${jobs.length} dry-run imports`}>
        <div className="space-y-2">{jobs.length ? jobs.map((item) => <a key={String(item.id)} href={`/seller/imports?job=${encodeURIComponent(String(item.id))}`} className={`block rounded-[14px] p-4 transition ${String(item.id) === selectedId ? "ink-1 bg-[#f0edff]" : "ink-1 bg-[#fafaf7] hover:bg-white"}`}><div className="flex items-center justify-between gap-3"><p className="font-bold capitalize">{String(item.source_type).replaceAll("_", " ")}</p><StatusPill status={String(item.status)} /></div><p className="mt-2 text-xs font-medium text-[var(--muted)]">{String(item.row_count)} rows · {String(item.matched_count)} auto-matched · {String(item.review_count)} review</p></a>) : <p className="text-sm font-medium text-[var(--muted)]">No imports yet.</p>}</div>
      </Panel>
      <Panel title={job ? `${String(job.source_type).replaceAll("_", " ")} import` : "No import selected"} description={job ? `${String(job.row_count)} products scanned. Review ambiguous rows before accepting.` : "Connect a source to create your first dry-run."} action={job && String(job.status) !== "imported" ? <form action={acceptImportJobAction}><input type="hidden" name="jobId" value={String(job.id)} /><button className={primaryButton}>Accept selected rows <ArrowRight className="ml-2 size-4" /></button></form> : undefined}>
        <div className="space-y-3">{rows.map((row) => {
          const payload = record(row.normalized_payload);
          const matched = String(row.match_status);
          return <div key={String(row.id)} className="ink-1 rounded-[16px] p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-start"><div className={`grid size-10 shrink-0 place-items-center rounded-full ${matched === "auto_matched" || matched === "confirmed" ? "ink-1 bg-[#e6fbf4] text-[#0e8f80]" : matched === "needs_review" ? "ink-1 bg-[#fff4e0] text-[#b26a00]" : "ink-1 bg-[#fff1f0] text-[#d3372c]"}`}>{matched === "auto_matched" || matched === "confirmed" ? <Check className="size-4" /> : matched === "needs_review" ? <SearchCheck className="size-4" /> : <TriangleAlert className="size-4" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-extrabold">{String(payload.title ?? "Untitled")}</p><StatusPill status={matched} /></div><p className="mt-1 text-xs font-medium text-[var(--muted)]">{String(payload.sku ?? "No SKU")} · {String(payload.quantityLabel ?? "Quantity unknown")} · ${Number(payload.price ?? 0).toFixed(2)}</p><p className="mt-2 text-xs font-medium text-[var(--muted)]">Suggested: <b className="text-[#111214]">{String(row.compound_name ?? "No canonical match")}</b> · {Math.round(Number(row.match_score ?? 0) * 100)}% confidence</p></div><form action={confirmImportRowAction} className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto] lg:w-[360px]"><input type="hidden" name="rowId" value={String(row.id)} /><input type="hidden" name="jobId" value={selectedId} /><select className="field" name="compoundEntityId" defaultValue={String(row.canonical_compound_id ?? "")}><option value="">Manual review required</option>{compounds.map((compound) => <option key={compound.id} value={compound.id}>{compound.display_name}</option>)}</select><label className="flex items-center gap-2 text-xs text-[var(--muted)]"><input type="checkbox" name="selected" defaultChecked={Boolean(row.selected)} />Include</label><button className={secondaryButton}>Confirm</button></form></div></div>;
        })}</div>
      </Panel>
    </div>
  </>;
}
