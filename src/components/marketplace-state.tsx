"use client";

import type { CatalogSnapshot, Product } from "@/lib/types";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

interface MarketplaceContextValue {
  catalog: CatalogSnapshot;
  watchlist: string[];
  compare: string[];
  isWatched: (slug: string) => boolean;
  isCompared: (slug: string) => boolean;
  toggleWatchlist: (slug: string) => void;
  toggleCompare: (slug: string) => void;
  clearCompare: () => void;
  openSearch: () => void;
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);
const WATCHLIST_KEY = "vial-watchlist-v1";
const COMPARE_KEY = "vial-compare-v1";

function readStoredList(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function MarketplaceProvider({ children, catalog, initialWatchlist = [], initialCompare = [], authenticated = false }: { children: React.ReactNode; catalog: CatalogSnapshot; initialWatchlist?: string[]; initialCompare?: string[]; authenticated?: boolean }) {
  const [watchlist, setWatchlist] = useState<string[]>(initialWatchlist);
  const [compare, setCompare] = useState<string[]>(initialCompare);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // The provider survives client-side transitions (e.g. the login redirect), so its
  // state can be stale [] while `authenticated` flips true. Only sync the comparison
  // to the server after the user actually changed it in this session — otherwise the
  // first authenticated render would overwrite the stored comparison with [].
  const compareDirty = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!authenticated) setWatchlist(readStoredList(WATCHLIST_KEY));
      if (!authenticated) setCompare(readStoredList(COMPARE_KEY));
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [authenticated]);

  useEffect(() => { if (hydrated && !authenticated) window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist)); }, [authenticated, hydrated, watchlist]);
  useEffect(() => {
    if (!hydrated) return;
    if (authenticated) {
      if (compareDirty.current) void fetch("/api/v1/comparisons", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingSlugs: compare }) });
    } else {
      window.localStorage.setItem(COMPARE_KEY, JSON.stringify(compare));
    }
  }, [authenticated, compare, hydrated]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const validSlugs = useMemo(() => new Set(catalog.products.map((product) => product.slug)), [catalog.products]);
  const toggleWatchlist = useCallback((slug: string) => {
    if (!validSlugs.has(slug)) return;
    setWatchlist((current) => {
      const watched = !current.includes(slug);
      const next = watched ? [...current, slug] : current.filter((item) => item !== slug);
      if (authenticated) {
        void fetch("/api/v1/watchlist", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, watched }) });
        void fetch("/api/v1/decision-events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventType: watched ? "listing_saved" : "listing_removed", subjectType: "listing", subjectId: slug }) });
      }
      return next;
    });
  }, [authenticated, validSlugs]);
  const toggleCompare = useCallback((slug: string) => {
    if (!validSlugs.has(slug)) return;
    compareDirty.current = true;
    setCompare((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : current.length >= 4 ? [...current.slice(1), slug] : [...current, slug];
      if (authenticated) void fetch("/api/v1/decision-events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventType: "comparison_updated", subjectType: "comparison", subjectId: "default", metadata: { listingSlugs: next } }) });
      return next;
    });
  }, [authenticated, validSlugs]);

  const value = useMemo<MarketplaceContextValue>(() => ({
    catalog,
    watchlist,
    compare,
    isWatched: (slug) => watchlist.includes(slug),
    isCompared: (slug) => compare.includes(slug),
    toggleWatchlist,
    toggleCompare,
    clearCompare: () => { compareDirty.current = true; setCompare([]); },
    openSearch: () => setSearchOpen(true),
  }), [catalog, compare, toggleCompare, toggleWatchlist, watchlist]);

  return <MarketplaceContext.Provider value={value}>
    {children}
    {searchOpen && <SearchOverlay catalog={catalog} onClose={() => setSearchOpen(false)} />}
    <CompareDock products={catalog.products} selected={compare} onClear={() => { compareDirty.current = true; setCompare([]); }} />
  </MarketplaceContext.Provider>;
}

export function useMarketplace() {
  const context = useContext(MarketplaceContext);
  if (!context) throw new Error("useMarketplace must be used within MarketplaceProvider");
  return context;
}

function SearchOverlay({ catalog, onClose }: { catalog: CatalogSnapshot; onClose: () => void }) {
  const { compounds, products, vendors } = catalog;
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);

  const results = useMemo(() => {
    if (!deferredQuery) return { compounds: compounds.slice(0, 4), products: products.filter((product) => product.featured).slice(0, 4), vendors: vendors.slice(0, 3) };
    return {
      compounds: compounds.filter((compound) => [compound.name, compound.shorthand, ...compound.aliases].join(" ").toLowerCase().includes(deferredQuery)).slice(0, 5),
      products: products.filter((product) => {
        const vendor = vendors.find((item) => item.slug === product.vendorSlug);
        return `${product.name} ${product.quantity} ${vendor?.name ?? ""}`.toLowerCase().includes(deferredQuery);
      }).slice(0, 6),
      vendors: vendors.filter((vendor) => vendor.name.toLowerCase().includes(deferredQuery)).slice(0, 4),
    };
  }, [compounds, deferredQuery, products, vendors]);
  const resultCount = results.compounds.length + results.products.length + results.vendors.length;

  return <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/45 px-4 pt-[8vh] backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
    <section aria-label="Search VIAL" aria-modal="true" role="dialog" className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/40 bg-[var(--surface)] shadow-[0_40px_120px_rgba(0,0,0,.3)]" onMouseDown={(event)=>event.stopPropagation()}>
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4"><Search className="size-5 text-[var(--muted)]" aria-hidden="true"/><input autoFocus value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search compounds, vendors, or listings" className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-[var(--muted)]" aria-label="Search query"/><button onClick={onClose} className="rounded-full border border-[var(--line)] p-2 text-[var(--muted)] transition hover:bg-black/[.04] hover:text-black" aria-label="Close search"><X className="size-4"/></button></div>
      <div className="max-h-[65vh] overflow-y-auto p-3">{resultCount===0?<div className="px-5 py-14 text-center"><p className="text-lg font-medium">No matching records</p><p className="mt-2 text-sm text-[var(--muted)]">Try a compound name, vendor, or quantity.</p></div>:<div className="space-y-5 p-2">
        {results.compounds.length>0&&<SearchSection label="Compounds">{results.compounds.map(compound=><SearchLink key={compound.slug} href={`/compounds/${compound.slug}`} title={compound.name} meta={`${compound.listings} listings · ${compound.documentationCoverage}% document coverage`} mark={compound.shorthand} accent={compound.accent[0]} onSelect={onClose}/>)}</SearchSection>}
        {results.products.length>0&&<SearchSection label="Listings">{results.products.map(product=>{const vendor=vendors.find(item=>item.slug===product.vendorSlug);return <SearchLink key={product.slug} href={`/products/${product.slug}`} title={`${product.name} ${product.quantity}`} meta={`${vendor?.name} · $${product.price} · ${product.evidenceLabel}`} mark={product.quantity} accent={product.accent[0]} onSelect={onClose}/>})}</SearchSection>}
        {results.vendors.length>0&&<SearchSection label="Vendors">{results.vendors.map(vendor=><SearchLink key={vendor.slug} href={`/vendors/${vendor.slug}`} title={vendor.name} meta={`${vendor.productCount} products · ${vendor.documentationCurrent}% current documentation`} mark={vendor.initials} accent={vendor.accent[0]} onSelect={onClose}/>)}</SearchSection>}
      </div>}</div>
      <div className="flex items-center justify-between border-t border-[var(--line)] px-5 py-3 text-xs text-[var(--muted)]"><span>Demo data unless marked Live</span><span className="hidden sm:inline">Press Esc to close</span></div>
    </section>
  </div>;
}
function SearchSection({label,children}:{label:string;children:React.ReactNode}){return <div><p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p><div className="space-y-1">{children}</div></div>}
function SearchLink({href,title,meta,mark,accent,onSelect}:{href:string;title:string;meta:string;mark:string;accent:string;onSelect:()=>void}){return <Link href={href} onClick={onSelect} className="group flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-black/[.045]"><div className="grid size-11 shrink-0 place-items-center rounded-xl border border-black/5 text-[10px] font-semibold tracking-tight text-white shadow-sm" style={{background:`linear-gradient(145deg, ${accent}, #111827)`}}>{mark}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold tracking-[-0.01em]">{title}</p><p className="mt-0.5 truncate text-xs text-[var(--muted)]">{meta}</p></div><span className="translate-x-0 text-sm text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-black">↗</span></Link>}
function CompareDock({products,selected,onClear}:{products:Product[];selected:string[];onClear:()=>void}){if(selected.length===0)return null;const selectedProducts=selected.map(slug=>products.find(product=>product.slug===slug)).filter((product):product is Product=>Boolean(product));return <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[calc(100%-2rem)] max-w-3xl"><div className="flex items-center gap-3 rounded-[22px] border border-white/20 bg-[#111214]/95 p-2.5 text-white shadow-[0_20px_70px_rgba(0,0,0,.35)] backdrop-blur-xl"><div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden pl-1">{selectedProducts.map(product=><div key={product.slug} className="flex min-w-0 items-center gap-2 rounded-xl bg-white/[.08] px-2.5 py-2"><span className="size-2 shrink-0 rounded-full" style={{background:product.accent[0]}}/><span className="truncate text-xs font-medium">{product.name} {product.quantity}</span></div>)}<span className="hidden shrink-0 text-xs text-white/50 md:block">{selected.length}/4 selected</span></div><button onClick={onClear} className="rounded-xl px-3 py-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white">Clear</button><Link href="/compare" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90">Compare</Link></div></div>}
