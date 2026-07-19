"use client";

import { Bell, Bookmark, CircleAlert, Clock3, GitBranch } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMarketplace } from "./marketplace-state";
import { ProductCard } from "./product-card";

interface ListingAlert {
  id: string;
  category: string;
  severity: string;
  title: string;
  message: string;
  createdAt: string;
  listingSlug: string;
  productName: string;
  vendorName: string;
  data: Record<string, unknown>;
}

export function WatchlistClient() {
  const { catalog, watchlist } = useMarketplace();
  const saved = useMemo(() => catalog.products.filter((product) => watchlist.includes(product.slug)), [catalog.products, watchlist]);
  const [alerts, setAlerts] = useState<ListingAlert[]>([]);

  useEffect(() => {
    if (!watchlist.length) return;
    const controller = new AbortController();
    fetch(`/api/v1/alerts?slugs=${encodeURIComponent(watchlist.join(","))}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Alert request failed")))
      .then((payload: { alerts?: ListingAlert[] }) => setAlerts(payload.alerts ?? []))
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setAlerts([]); });
    return () => controller.abort();
  }, [watchlist]);

  if (saved.length === 0) return <div><div className="rounded-[30px] border border-dashed border-black/15 bg-white/55 px-6 py-20 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-black text-white"><Bookmark className="size-5" /></span><h2 className="mt-6 text-2xl font-semibold tracking-[-0.04em]">Your watchlist is empty</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">Save listings to follow reviewed price, documentation, batch, and availability changes in one place.</p><Link href="/market" className="mt-6 inline-flex rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Browse market</Link></div><div className="mt-12"><div className="mb-6 flex items-center gap-3"><Bell className="size-5" /><h3 className="text-xl font-semibold tracking-[-0.03em]">Suggested to watch</h3></div><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{catalog.products.filter((product) => product.featured).slice(0,3).map((product) => <ProductCard key={product.slug} product={product} />)}</div></div></div>;

  return <div>
    <section className="rounded-[30px] bg-[#111214] p-5 text-white sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-white/40">Reviewed change feed</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">What changed across your records</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/45">Alerts are created only after a reviewed publication enters the causal event graph.</p></div><div className="rounded-2xl bg-white/10 px-4 py-3 text-right"><p className="text-2xl font-semibold tabular-nums">{alerts.length}</p><p className="text-[9px] uppercase tracking-[.12em] text-white/40">change alerts</p></div></div>
      <div className="mt-6 space-y-2">{alerts.slice(0,8).map((alert) => <Link href={`/products/${alert.listingSlug}`} key={alert.id} className="group flex flex-col gap-3 rounded-2xl border border-white/[.07] bg-white/[.045] p-4 transition hover:bg-white/[.08] sm:flex-row sm:items-center"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${alert.severity === "warning" ? "bg-amber-400/15 text-amber-300" : "bg-violet-400/15 text-violet-300"}`}>{alert.severity === "warning" ? <CircleAlert className="size-4" /> : <Bell className="size-4" />}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{alert.title}</p><p className="mt-1 text-xs leading-5 text-white/45">{alert.message}</p></div><div className="flex shrink-0 items-center gap-3 text-[10px] text-white/35"><span className="inline-flex items-center gap-1"><Clock3 className="size-3" />{new Date(alert.createdAt).toLocaleString()}</span><GitBranch className="size-3 transition group-hover:text-white" /></div></Link>)}{alerts.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">No reviewed changes have been published for these records yet.</div>}</div>
    </section>
    <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{saved.map((product) => <ProductCard key={product.slug} product={product} />)}</div>
  </div>;
}
