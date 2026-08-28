"use client";

import { Bell, Bookmark, CircleAlert, Clock3, GitBranch } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import type { ResolvedStack } from "@/lib/stacks";
import { useMarketplace } from "./marketplace-state";
import { ProductCard } from "./product-card";
import { StackCard } from "./market/stack-card";

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

// `products` comes from the /watchlist server component, not from useMarketplace(): the saved
// grid renders full market cards. A guest's watchlist lives in localStorage, so the server cannot
// know which listings to send and must send them all — but only to this page, not to every page.
export function WatchlistClient({ products, stacks = [] }: { products: Product[]; stacks?: ResolvedStack[] }) {
  const { watchlist, savedStacks, authenticated } = useMarketplace();
  const saved = useMemo(() => products.filter((product) => watchlist.includes(product.slug)), [products, watchlist]);
  // Saved stacks (KLOW, GLOW …) sit above the listings; a stack is the reader's shortlist of parts.
  const savedStackCards = useMemo(() => stacks.filter((r) => savedStacks.includes(r.stack.slug)), [stacks, savedStacks]);
  const [alerts, setAlerts] = useState<ListingAlert[]>([]);
  // The header counted every alert and the list rendered eight of them, with nothing in between
  // saying so — 23 alerts read as "23" above a list of 8. Page it instead.
  const ALERT_PAGE = 8;
  const [visibleAlerts, setVisibleAlerts] = useState(ALERT_PAGE);

  useEffect(() => {
    if (!watchlist.length) return;
    const controller = new AbortController();
    fetch(`/api/v1/alerts?slugs=${encodeURIComponent(watchlist.join(","))}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Alert request failed")))
      .then((payload: { alerts?: ListingAlert[] }) => { setAlerts(payload.alerts ?? []); setVisibleAlerts(ALERT_PAGE); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setAlerts([]); });
    return () => controller.abort();
  }, [watchlist]);

  if (saved.length === 0 && savedStackCards.length === 0) return <div><div className="ink-1 rounded-[20px] border-dashed bg-white px-6 py-20 text-center"><span className="ink mx-auto grid size-14 place-items-center rounded-[14px] bg-[#111214] text-white"><Bookmark className="size-5" /></span><h2 className="mt-6 text-2xl font-extrabold tracking-[-0.04em] text-[#111214]">Your watchlist is empty</h2><p className="mx-auto mt-3 max-w-md text-sm font-medium leading-6 text-[var(--muted)]">Save listings — or a stack like Wolverine or GLOW — to follow reviewed price, documentation, batch, and availability changes in one place.</p><Link href="/market" className="ink hard-sm press mt-6 inline-flex rounded-full bg-[#111214] px-5 py-3 text-sm font-bold text-white">Browse market</Link>{!authenticated && <p className="mx-auto mt-5 max-w-md text-xs font-medium leading-5 text-[var(--muted)]"><Link href="/register?next=/watchlist" className="font-bold text-[#111214] underline underline-offset-2">Create a free account</Link> to sync your saves across devices and get alerted when something changes.</p>}</div><div className="mt-12"><div className="mb-6 flex items-center gap-3"><Bell className="size-5" /><h3 className="text-xl font-extrabold tracking-[-0.03em] text-[#111214]">Suggested to watch</h3></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{products.filter((product) => product.featured).slice(0,3).map((product) => <ProductCard key={product.slug} product={product} />)}</div></div></div>;

  return <div>
    {savedStackCards.length > 0 && (
      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#0e8f80]">Saved stacks</p>
            <h2 className="mt-1.5 text-2xl font-extrabold tracking-[-.04em]">{savedStackCards.length} stack{savedStackCards.length === 1 ? "" : "s"}</h2>
          </div>
          <Link href="/stacks" className="text-sm font-bold text-[#2b31d8] underline underline-offset-2">All stacks</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{savedStackCards.map((r) => <StackCard key={r.stack.slug} resolved={r} fluid />)}</div>
      </section>
    )}
    {saved.length > 0 && <section className="ink hard-blue rounded-[20px] bg-[#111214] p-5 text-white sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#8fa2ff]">Reviewed change feed</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-.04em]">What changed across your records</h2><p className="mt-2 max-w-xl text-sm font-medium leading-6 text-white/50">Alerts are created only after a reviewed publication enters the causal event graph.</p></div><div className="rounded-[14px] border border-white/20 bg-white/10 px-4 py-3 text-right"><p className="text-2xl font-extrabold tabular-nums">{alerts.length}</p><p className="text-[9px] uppercase tracking-[.12em] text-white/50">change alerts</p></div></div>
      <div className="mt-6 space-y-2">{alerts.slice(0,visibleAlerts).map((alert) => <Link href={`/products/${alert.listingSlug}`} key={alert.id} className="group flex flex-col gap-3 rounded-[12px] border border-white/15 bg-white/[.06] p-4 transition hover:bg-white/[.1] sm:flex-row sm:items-center"><span className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${alert.severity === "warning" ? "bg-amber-400/20 text-amber-300" : "bg-violet-400/20 text-violet-300"}`}>{alert.severity === "warning" ? <CircleAlert className="size-4" /> : <Bell className="size-4" />}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold">{alert.title}</p><p className="mt-1 text-xs leading-5 text-white/50">{alert.message}</p></div><div className="flex shrink-0 items-center gap-3 text-[10px] text-white/40"><span className="inline-flex items-center gap-1"><Clock3 className="size-3" />{new Date(alert.createdAt).toLocaleString()}</span><GitBranch className="size-3 transition group-hover:text-white" /></div></Link>)}{alerts.length === 0 && <div className="rounded-[12px] border border-dashed border-white/20 p-6 text-center text-sm font-medium text-white/50">No reviewed changes have been published for these records yet.</div>}</div>
      {alerts.length > visibleAlerts && <div className="mt-4 flex flex-col items-center gap-2"><button onClick={() => setVisibleAlerts((current) => current + ALERT_PAGE)} className="ink-1 rounded-full border-white/25 bg-white/10 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/20">Show {Math.min(ALERT_PAGE, alerts.length - visibleAlerts)} more</button><p className="text-[11px] font-medium tabular-nums text-white/40">Showing {visibleAlerts} of {alerts.length}</p></div>}
    </section>}
    {saved.length > 0 ? (
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{saved.map((product) => <ProductCard key={product.slug} product={product} />)}</div>
    ) : (
      <p className="ink-1 rounded-[16px] border-dashed bg-white px-6 py-10 text-center text-sm font-semibold text-[var(--muted)]">No saved listings yet — <Link href="/market" className="font-bold text-[#111214] underline underline-offset-2">browse the market</Link> and tap the bookmark on any listing.</p>
    )}
  </div>;
}
