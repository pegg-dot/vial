import { Building2, FileCheck2, PlugZap, ShoppingBag } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

function parsed<T>(value: unknown, fallback: T): T { if (typeof value === "string") { try { return JSON.parse(value) as T; } catch { return fallback; } } return (value as T) ?? fallback; }

export default async function AdminSellersPage() {
  await requirePermission("commerce:read");
  const db = await getDatabase();
  const rows = (await db.query(`
    SELECT cs.id,o.display_name,cs.status,p.onboarding_status,p.readiness_state,p.submitted_at,
      (SELECT completion_percent FROM seller_readiness_snapshots r WHERE r.seller_id=cs.id ORDER BY r.created_at DESC LIMIT 1) completion_percent,
      (SELECT dimensions FROM seller_readiness_snapshots r WHERE r.seller_id=cs.id ORDER BY r.created_at DESC LIMIT 1) dimensions,
      (SELECT COUNT(*) FROM seller_products sp WHERE sp.seller_id=cs.id) products,
      (SELECT COUNT(*) FROM seller_integrations si WHERE si.seller_id=cs.id AND si.status IN ('connected','sandbox_ready')) integrations,
      (SELECT COUNT(*) FROM seller_evidence_documents d WHERE d.seller_id=cs.id) documents
    FROM commerce_sellers cs JOIN organizations o ON o.id=cs.organization_id LEFT JOIN seller_profiles p ON p.seller_id=cs.id
    ORDER BY COALESCE(p.submitted_at,p.updated_at) DESC NULLS LAST,o.display_name`)).rows as Array<Record<string, unknown>>;
  return <>
    <div className="border-b-2 border-[#111214] pb-7"><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#2b31d8]">Seller network</p><h1 className="mt-3 text-4xl font-extrabold tracking-[-.05em]">Onboarding and readiness</h1><p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">Review seller packages dimension by dimension. A connected store or payment account cannot hide missing evidence or operations data.</p></div>
    <div className="mt-7 space-y-4">{rows.map((row) => { const dimensions = parsed<Array<{ key: string; label: string; status: string; score: number }>>(row.dimensions, []); return <section key={String(row.id)} className="ink hard rounded-[20px] bg-white p-5"><div className="flex flex-col gap-5 lg:flex-row lg:items-start"><div className="ink grid size-12 place-items-center rounded-[12px] bg-[#111214] text-white"><Building2 className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-extrabold tracking-[-.035em]">{String(row.display_name)}</h2><span className="ink-1 rounded-full bg-[#f7f7f4] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide">{String(row.onboarding_status || "not started").replaceAll("_", " ")}</span><span className="ink-1 rounded-full bg-[#e9eaff] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#2b31d8]">{String(row.readiness_state || "blocked").replaceAll("_", " ")}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="flex items-center gap-2 text-sm font-medium text-[var(--muted)]"><ShoppingBag className="size-4" />{String(row.products)} products</div><div className="flex items-center gap-2 text-sm font-medium text-[var(--muted)]"><PlugZap className="size-4" />{String(row.integrations)} connections</div><div className="flex items-center gap-2 text-sm font-medium text-[var(--muted)]"><FileCheck2 className="size-4" />{String(row.documents)} documents</div></div><div className="mt-5 flex flex-wrap gap-2">{dimensions.map((dimension) => <span key={dimension.key} className={`ink-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${dimension.status === "complete" ? "bg-[#e6fbf4] text-[#0e8f80]" : dimension.status === "blocked" ? "bg-[#fff1f0] text-[#d3372c]" : "bg-[#fff4e0] text-[#b26a00]"}`}>{dimension.label} {Math.round(Number(dimension.score) * 100)}%</span>)}</div></div><div className="lg:text-right"><p className="text-4xl font-extrabold tracking-[-.05em]">{Number(row.completion_percent ?? 0)}%</p><p className="text-xs font-medium text-[var(--muted)]">readiness</p></div></div></section>; })}</div>
  </>;
}
