import { Clock3, PackageCheck, Truck } from "lucide-react";
import { Panel, primaryButton, SellerPageHeader, StatusPill } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import { getSellerContext } from "@/server/seller/ops";
import { fulfillSellerOrderAction } from "../actions";

export default async function SellerOrdersPage() {
  const principal = await requireSellerPermission("seller:orders:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  const db = await getDatabase();
  const shipments = (await db.query(`SELECT * FROM commerce_shipments WHERE seller_id=$1 ORDER BY created_at DESC`, [context.sellerId])).rows as Array<Record<string, unknown>>;
  const shipmentByOrder = new Map(shipments.map((shipment) => [String(shipment.order_id), shipment]));
  return <><SellerPageHeader title="Orders" description="Accept and fulfill seller-specific order allocations without exposing another seller’s customer or financial data." />
    <div className="mt-7 space-y-4">{context.orders.length ? context.orders.map((row) => { const order = row as Record<string, unknown>; const shipment=shipmentByOrder.get(String(order.id)); const shipped=String(shipment?.status)==="shipped"; return <Panel key={String(order.id)} action={<StatusPill status={shipped?"shipped":String(order.status)} />}><div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-black/35">{String(order.id)}</p><h2 className="mt-2 text-lg font-semibold">{String(order.email)}</h2><div className="mt-3 flex flex-wrap gap-4 text-xs text-black/45"><span className="flex items-center gap-1.5"><Clock3 className="size-3.5" />{new Date(String(order.created_at)).toLocaleString()}</span><span className="flex items-center gap-1.5"><PackageCheck className="size-3.5" />Seller allocation ${Number(order.seller_total).toFixed(2)}</span>{Boolean(shipment?.tracking_code)&&<span className="flex items-center gap-1.5"><Truck className="size-3.5" />{String(shipment?.carrier)} · {String(shipment?.tracking_code)}</span>}</div></div>{!shipped&&<form action={fulfillSellerOrderAction} className="grid gap-2 sm:grid-cols-[140px_180px_auto]"><input type="hidden" name="orderId" value={String(order.id)} /><input className="field" name="carrier" defaultValue="VIAL Sandbox" aria-label="Shipping carrier" /><input className="field" name="trackingCode" required placeholder="Tracking code" aria-label="Tracking code" /><button className={primaryButton}>Mark shipped</button></form>}</div></Panel>; }) : <Panel><p className="text-sm text-black/45">No sandbox orders yet.</p></Panel>}</div>
  </>;
}
