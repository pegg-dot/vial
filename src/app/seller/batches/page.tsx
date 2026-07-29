import { FlaskConical } from "lucide-react";
import { SellerPageHeader, Panel, StatusPill, primaryButton } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getSellerContext } from "@/server/seller/ops";
import { createBatchAction } from "../actions";

export default async function SellerBatchesPage() {
  const principal = await requireSellerPermission("seller:catalog:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  return <>
    <SellerPageHeader title="Batches" description="Track declared production lots independently from product records, inventory, and supporting evidence." />
    <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{context.batches.map((row) => { const batch = row as Record<string, unknown>; return <Panel key={String(batch.id)} action={<StatusPill status={String(batch.status)} />}><div className="flex gap-4"><div className="ink-1 grid size-12 place-items-center rounded-[14px] bg-[#f0edff] text-[#6d5dfc]"><FlaskConical className="size-5" /></div><div><h2 className="font-extrabold">{String(batch.batch_code)}</h2><p className="mt-1 text-sm font-medium text-[var(--muted)]">{String(batch.product_title)}</p></div></div><dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-xs text-[var(--muted)]">Available</dt><dd className="mt-1 font-extrabold">{String(batch.quantity_available)}</dd></div><div><dt className="text-xs text-[var(--muted)]">Expires</dt><dd className="mt-1 font-extrabold">{String(batch.expiration_date || "Not set")}</dd></div></dl></Panel>; })}</div>
    <Panel title="Add a batch" description="A batch remains draft until evidence and inventory relationships are reviewed." className="mt-7"><form action={createBatchAction} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><label className="text-sm font-medium xl:col-span-2">Product<select className="field mt-2" name="productId" required>{context.products.map((row) => <option key={String((row as { id?: unknown }).id)} value={String((row as { id?: unknown }).id)}>{String((row as { title?: unknown }).title)}</option>)}</select></label><label className="text-sm font-medium">Batch code<input className="field mt-2" name="batchCode" required /></label><label className="text-sm font-medium">Quantity<input className="field mt-2" type="number" min="0" name="quantity" required /></label><label className="text-sm font-medium">Produced<input className="field mt-2" type="date" name="productionDate" /></label><label className="text-sm font-medium">Expires<input className="field mt-2" type="date" name="expirationDate" /></label><button className={`${primaryButton} sm:w-fit`}>Create batch</button></form></Panel>
  </>;
}
