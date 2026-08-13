import { Boxes, CircleDollarSign, PackagePlus } from "lucide-react";
import { SellerPageHeader, Panel, StatusPill, primaryButton } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import { getSellerContext } from "@/server/seller/ops";
import { createProductAction } from "../actions";

export default async function SellerCatalogPage() {
  const principal = await requireSellerPermission("seller:catalog:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  const db = await getDatabase();
  const compounds = (await db.query(`SELECT id,display_name FROM canonical_entities WHERE entity_type='compound' ORDER BY display_name`)).rows as Array<{ id: string; display_name: string }>;
  return <>
    <SellerPageHeader title="Products" description="Manage normalized product records before they become marketplace listings. Canonical matching, evidence, and batch readiness remain separate states." action={<a href="#new-product" className={primaryButton}><PackagePlus className="mr-2 size-4" />New product</a>} />
    <div className="mt-7 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
      {context.products.map((row) => { const product = row as Record<string, unknown>; return <Panel key={String(product.id)} action={<StatusPill status={String(product.status)} />}>
        <div className="flex items-start gap-4"><div className="ink-1 grid size-12 shrink-0 place-items-center rounded-[14px] bg-[#f0efeb]"><Boxes className="size-5" /></div><div className="min-w-0"><h2 className="text-lg font-extrabold tracking-[-.03em]">{String(product.title)}</h2><p className="mt-1 text-xs font-medium text-[var(--muted)]">{String(product.sku || "No SKU")} · {String(product.quantity_label)}</p></div></div>
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-[#111214]/10 pt-5"><div><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Compound</p><p className="mt-1 truncate text-sm font-medium">{String(product.compound_name || "Unmatched")}</p></div><div><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Price</p><p className="mt-1 text-sm font-medium">${Number(product.price).toFixed(2)}</p></div><div><p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Inventory</p><p className="mt-1 text-sm font-medium">{String(product.inventory)}</p></div></div>
        <div className="mt-4 flex items-center justify-between text-xs"><span className="font-medium text-[var(--muted)]">Match confidence</span><b>{Math.round(Number(product.match_confidence ?? 0) * 100)}%</b></div><div className="mt-2 h-1.5 rounded-full bg-[#111214]/10"><div className="h-full rounded-full bg-[#6d5dfc]" style={{ width: `${Math.round(Number(product.match_confidence ?? 0) * 100)}%` }} /></div>
      </Panel>; })}
    </div>
    <Panel id="new-product" title="Create a product manually" description="Manual products stay in draft until catalog, evidence, and policy checks are complete." className="mt-7">
      <form action={createProductAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium md:col-span-2">Product title<input className="field mt-2" name="title" required placeholder="BPC-157 Research Vial" /></label>
        <label className="text-sm font-medium">Canonical compound<select className="field mt-2" name="compoundEntityId" defaultValue=""><option value="">Select later</option>{compounds.map((compound) => <option key={compound.id} value={compound.id}>{compound.display_name}</option>)}</select></label>
        <label className="text-sm font-medium">SKU<input className="field mt-2" name="sku" placeholder="BPC10" /></label>
        <label className="text-sm font-medium">Quantity<input className="field mt-2" name="quantityLabel" required placeholder="10 mg" /></label>
        <label className="text-sm font-medium">Price<div className="relative mt-2"><CircleDollarSign className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" /><input className="field pl-10" name="price" type="number" step="0.01" min="0" required /></div></label>
        <label className="text-sm font-medium">Inventory<input className="field mt-2" name="inventory" type="number" min="0" required /></label>
        <label className="text-sm font-medium md:col-span-2 xl:col-span-4">Description<textarea className="field mt-2 min-h-24" name="description" /></label>
        <button className={`${primaryButton} md:w-fit`}>Create draft</button>
      </form>
    </Panel>
  </>;
}
