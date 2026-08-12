"use client";

import { Minus, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCommerceCart } from "./commerce-cart-provider";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export function CartPageClient() {
  const { cart, loading, setQuantity } = useCommerceCart();
  if (loading && !cart) return <div className="py-24 text-center text-[var(--muted)]">Loading sandbox cart…</div>;
  if (!cart || !cart.lines.length) {
    return (
      <div className="rounded-[30px] border border-black/[.07] bg-white p-12 text-center">
        <h2 className="text-2xl font-semibold">Your sandbox cart is empty</h2>
        <p className="mt-3 text-sm text-[var(--muted)]">Eligible fictional listings can be added from their product pages.</p>
        <Link href="/market" className="mt-6 inline-flex rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Browse market</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        {cart.lines.map((line) => (
          <article key={line.id} className="rounded-[26px] border border-black/[.07] bg-white p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="grid size-20 place-items-center rounded-2xl bg-gradient-to-br from-violet-100 to-emerald-50 text-sm font-bold">{line.name.slice(0, 3).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--muted)]">{line.vendor}</p>
                <Link href={`/products/${line.slug}`} className="mt-1 block text-xl font-semibold">{line.name} <span className="text-black/35">{line.quantityLabel}</span></Link>
                <p className="mt-2 text-sm text-[var(--muted)]">Sandbox eligible · seller-fulfilled</p>
              </div>
              <div className="flex items-center justify-between gap-5">
                <div className="flex items-center rounded-full border border-black/[.09]">
                  <button onClick={() => setQuantity(line.id, line.quantity - 1)} className="grid size-10 place-items-center" aria-label="Decrease quantity">
                    {line.quantity === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{line.quantity}</span>
                  <button onClick={() => setQuantity(line.id, line.quantity + 1)} className="grid size-10 place-items-center" aria-label="Increase quantity"><Plus className="size-4" /></button>
                </div>
                <p className="w-24 text-right text-lg font-semibold">{money(line.unitPrice * line.quantity)}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
      <aside className="h-fit rounded-[30px] bg-[#111214] p-6 text-white lg:sticky lg:top-24">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><ShieldCheck className="size-4" />Test mode only</div>
        <h2 className="mt-4 text-2xl font-semibold">Order summary</h2>
        <dl className="mt-6 space-y-3 text-sm">
          <SummaryRow label="Subtotal" value={money(cart.subtotal)} />
          <SummaryRow label="Seller shipping" value={money(cart.shipping)} />
          <SummaryRow label="VialGrade fee" value={money(cart.platformFee)} />
          <SummaryRow label="Estimated tax" value={money(cart.tax)} />
          <div className="border-t border-white/15 pt-4"><SummaryRow label="Total" value={money(cart.total)} strong /></div>
        </dl>
        {cart.issues.length > 0 && <div className="mt-5 rounded-2xl bg-amber-300/10 p-4 text-xs leading-5 text-amber-100">{cart.issues.join(" · ")}</div>}
        <Link href="/checkout" aria-disabled={!cart.eligible} className={`mt-6 flex w-full justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold ${cart.eligible ? "bg-white text-black" : "pointer-events-none bg-white/20 text-white/50"}`}>Continue to sandbox checkout</Link>
        <p className="mt-4 text-xs leading-5 text-white/50">No card details are collected and no real funds move in this build.</p>
      </aside>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between gap-5 ${strong ? "text-base font-semibold" : "text-white/70"}`}><dt>{label}</dt><dd className="text-white">{value}</dd></div>;
}
