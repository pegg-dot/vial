import { Plus } from "lucide-react";
import { SellerPageHeader, Panel, StatusPill, primaryButton } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getSellerContext } from "@/server/seller/ops";
import { adjustInventoryAction } from "../actions";

export default async function SellerInventoryPage() {
  const principal = await requireSellerPermission("seller:catalog:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  return <><SellerPageHeader title="Inventory" description="Adjust seller inventory through an immutable event ledger. Every change records actor, source, delta, and resulting quantity." />
    <div className="mt-7 space-y-4">{context.products.map((row) => { const p = row as Record<string, unknown>; const low = Number(p.inventory) <= 5; return <Panel key={String(p.id)} action={<StatusPill status={low ? "low_stock" : "in_stock"} />}><div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center"><div><h2 className="text-lg font-extrabold">{String(p.title)}</h2><p className="mt-1 text-sm font-medium text-[var(--muted)]">{String(p.sku || "No SKU")} · {String(p.compound_name || "Unmatched")}</p><p className="mt-4 text-4xl font-extrabold tracking-[-.05em]">{String(p.inventory)} <span className="text-sm font-medium text-[var(--muted)]">units available</span></p></div><form action={adjustInventoryAction} className="flex flex-wrap items-end gap-3"><input type="hidden" name="productId" value={String(p.id)} /><label className="text-sm font-medium">Adjustment<input className="field mt-2 w-36" name="delta" type="number" required placeholder="+10 or -2" /></label><button className={primaryButton}><Plus className="mr-2 size-4" />Apply change</button></form></div></Panel>; })}</div>
  </>;
}
