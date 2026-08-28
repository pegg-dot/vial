"use client";

import type { CatalogLite, ProductLite } from "@/lib/catalog-lite";
import { displayProductTitle } from "@/lib/product-title";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { pruneStackSlugs, stackKey } from "@/lib/saved-stacks";
import { stackBySlug } from "@/lib/stacks";
import { AUTH_PROMPT_DELAY_MS, AuthPromptOverlay, markAuthPromptDismissed, readAuthPromptDismissed, readAuthPromptDismissedOnServer, shouldAutoPrompt, subscribeAuthPromptDismissed, type AuthPromptRequest } from "./auth-prompt";

interface MarketplaceContextValue {
  // Deliberately the LITE projection, not the full snapshot: this value rides in the HTML of
  // every page on the site. If a surface needs whole records it takes them as a prop from its
  // own server component (see /market, /compounds, /watchlist) rather than widening this.
  catalog: CatalogLite;
  watchlist: string[];
  // Saved stacks (KLOW, GLOW …) — same store as the watchlist under a "stack:" key, split here so
  // `watchlist` stays listing slugs for every surface that already reads it.
  savedStacks: string[];
  compare: string[];
  isWatched: (slug: string) => boolean;
  isStackSaved: (slug: string) => boolean;
  toggleStackSave: (slug: string) => void;
  isCompared: (slug: string) => boolean;
  toggleWatchlist: (slug: string) => void;
  toggleCompare: (slug: string) => void;
  clearCompare: () => void;
  openSearch: () => void;
  authenticated: boolean;
  /**
   * Ask the visitor to make an account, then run `onAuthenticated`. Callers use this instead of
   * redirecting to /login so the thing the visitor was doing survives the sign-up. Calling it while
   * already authenticated runs the callback immediately and shows nothing.
   */
  promptSignIn: (request: AuthPromptRequest) => void;
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);
const WATCHLIST_KEY = "vial-watchlist-v1";
const SAVED_STACKS_KEY = "vial-saved-stacks-v1";
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

export function MarketplaceProvider({ children, catalog: catalogProp, initialWatchlist = [], initialSavedStacks = [], initialCompare = [], authenticated = false }: { children: React.ReactNode; catalog: CatalogLite; initialWatchlist?: string[]; initialSavedStacks?: string[]; initialCompare?: string[]; authenticated?: boolean }) {
  // The provider (and its catalog prop) is captured once at hard load and frozen across soft
  // navigations, so every client surface — market grid, search, cards, compare dock — would
  // drift from the freshly server-rendered detail pages and the compare table whenever the
  // catalog changes mid-session. Re-pull the live snapshot on focus + a slow interval, and use
  // whichever of the fetched snapshot or the server prop is newer (by generatedAt) — so a fresh
  // server prop from router.refresh wins immediately, with no setState-in-effect re-seed.
  const [fetchedCatalog, setFetchedCatalog] = useState<CatalogLite | null>(null);
  const catalog = fetchedCatalog && fetchedCatalog.generatedAt > catalogProp.generatedAt ? fetchedCatalog : catalogProp;
  const [watchlist, setWatchlist] = useState<string[]>(initialWatchlist);
  const [savedStacks, setSavedStacks] = useState<string[]>(initialSavedStacks);
  const [compare, setCompare] = useState<string[]>(initialCompare);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<AuthPromptRequest | null>(null);
  // Persisted, so "not now" means not again — the brief is explicit that the prompt asks once and
  // then leaves the account button in the header to do the job.
  const promptDismissed = useSyncExternalStore(subscribeAuthPromptDismissed, readAuthPromptDismissed, readAuthPromptDismissedOnServer);
  const pathname = usePathname();
  // The provider survives client-side transitions (e.g. the login redirect), so its
  // state can be stale [] while `authenticated` flips true. Only sync the comparison
  // to the server after the user actually changed it in this session — otherwise the
  // first authenticated render would overwrite the stored comparison with [].
  const compareDirty = useRef(false);
  // Who the in-memory lists belong to. Sign-out is a soft navigation: `authenticated` flips false
  // while the account's lists are still in state, and the guest persist effects below would write
  // them into this device's storage — where the next person to sign in would inherit them. Guest
  // storage is written only while the lists are guest-owned; the sign-out frame replaces them.
  const owner = useRef<"guest" | "account">(authenticated ? "account" : "guest");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!authenticated) {
        if (owner.current === "account") {
          // Just signed out: what is in state is the account's. Replace it with the device's own.
          setWatchlist(readStoredList(WATCHLIST_KEY));
          setSavedStacks(pruneStackSlugs(readStoredList(SAVED_STACKS_KEY)));
        } else {
          // Merge, never replace: a save clicked in the gap between React hydration and this frame
          // was being overwritten by the stored list, so the button flipped, the badge counted it,
          // and nothing was saved. Nothing can have been UN-saved that early, so a union is exact.
          setWatchlist((current) => Array.from(new Set([...readStoredList(WATCHLIST_KEY), ...current])));
          setSavedStacks((current) => pruneStackSlugs(Array.from(new Set([...readStoredList(SAVED_STACKS_KEY), ...current]))));
        }
        setCompare(readStoredList(COMPARE_KEY));
        owner.current = "guest";
      } else {
        owner.current = "account";
        // Same merge for stacks a guest saved before signing in.
        const guestStacks = readStoredList(SAVED_STACKS_KEY).filter((slug) => !initialSavedStacks.includes(slug));
        if (guestStacks.length) {
          setSavedStacks((current) => Array.from(new Set([...current, ...guestStacks])));
          for (const slug of guestStacks) {
            void fetch("/api/v1/watchlist", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: stackKey(slug), watched: true }) });
          }
        }
        window.localStorage.removeItem(SAVED_STACKS_KEY);
        // Merge any watchlist a guest saved BEFORE signing in/up — otherwise those
        // saves were silently dropped at exactly the moment the buyer committed.
        const guestSaves = readStoredList(WATCHLIST_KEY).filter((slug) => !initialWatchlist.includes(slug));
        if (guestSaves.length) {
          setWatchlist((current) => Array.from(new Set([...current, ...guestSaves])));
          for (const slug of guestSaves) {
            void fetch("/api/v1/watchlist", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, watched: true }) });
          }
        }
        window.localStorage.removeItem(WATCHLIST_KEY);
      }
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [authenticated, initialWatchlist, initialSavedStacks]);

  useEffect(() => { if (hydrated && !authenticated && owner.current === "guest") window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist)); }, [authenticated, hydrated, watchlist]);
  useEffect(() => { if (hydrated && !authenticated && owner.current === "guest") window.localStorage.setItem(SAVED_STACKS_KEY, JSON.stringify(savedStacks)); }, [authenticated, hydrated, savedStacks]);

  // The delayed ask. It fires once per page the visitor settles on, only while the tab is actually
  // in front of them — a timer that burns down in a background tab would surface the dialog on a
  // page the visitor has no memory of opening.
  useEffect(() => {
    if (!shouldAutoPrompt({ pathname, authenticated, dismissed: promptDismissed })) return;
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => setAuthPrompt((current) => current ?? {}), AUTH_PROMPT_DELAY_MS);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", arm); };
  }, [authenticated, pathname, promptDismissed]);

  const promptSignIn = useCallback((request: AuthPromptRequest) => {
    // Already signed in: there is nothing to ask, so just do the thing.
    if (authenticated) { void request.onAuthenticated?.(); return; }
    setAuthPrompt(request);
  }, [authenticated]);

  const closeAuthPrompt = useCallback((dismissedForever: boolean) => {
    setAuthPrompt(null);
    if (dismissedForever) markAuthPromptDismissed();
  }, []);
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
  // Track the live catalog so client surfaces stay in step with server-rendered pages.
  //
  // This polled every 120s AND on every tab focus, with cache:"no-store", pulling the WHOLE catalog
  // each time. One tab left open for a working day made ~720 full-catalog requests, and every one
  // was a full read of the database behind it. That is a client-side version of the same problem
  // that exhausted the database quota.
  //
  // The catalog changes once a day, when the collect cron runs. A 15-minute poll is already far
  // more often than the data can possibly change. The focus-triggered refresh is kept because
  // returning to a stale tab is exactly when a refresh is worth something, but it now only fires if
  // the data is actually old rather than on every alt-tab.
  useEffect(() => {
    let alive = true;
    let lastFetched = Date.now();
    const REFRESH_MS = 900_000; // 15 min; the underlying data moves once a day
    const refresh = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        // ?shape=lite: the poller only ever feeds the search overlay, the compare dock and the
        // market card, so pulling whole listings here would re-import the megabyte this projection
        // exists to remove — four times an hour, per open tab, forever.
        const r = await fetch("/api/v1/catalog?shape=lite");
        if (!r.ok) return;
        const j = await r.json();
        lastFetched = Date.now();
        if (alive && j?.data?.products) setFetchedCatalog(j.data as CatalogLite);
      } catch { /* keep the last-good catalog */ }
    };
    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetched > REFRESH_MS) void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => { alive = false; document.removeEventListener("visibilitychange", onVis); window.clearInterval(id); };
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
  const toggleStackSave = useCallback((slug: string) => {
    if (!stackBySlug(slug)) return;
    setSavedStacks((current) => {
      const saved = !current.includes(slug);
      const next = saved ? [...current, slug] : current.filter((item) => item !== slug);
      if (authenticated) {
        void fetch("/api/v1/watchlist", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: stackKey(slug), watched: saved }) });
        void fetch("/api/v1/decision-events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventType: saved ? "stack_saved" : "stack_removed", subjectType: "stack", subjectId: slug }) });
      }
      return next;
    });
  }, [authenticated]);
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
    savedStacks,
    compare,
    isWatched: (slug) => watchlist.includes(slug),
    isStackSaved: (slug) => savedStacks.includes(slug),
    toggleStackSave,
    isCompared: (slug) => compare.includes(slug),
    toggleWatchlist,
    toggleCompare,
    clearCompare: () => { compareDirty.current = true; setCompare([]); },
    openSearch: () => setSearchOpen(true),
    authenticated,
    promptSignIn,
  }), [authenticated, catalog, compare, promptSignIn, savedStacks, toggleCompare, toggleStackSave, toggleWatchlist, watchlist]);

  return <MarketplaceContext.Provider value={value}>
    {children}
    {searchOpen && <SearchOverlay catalog={catalog} onClose={() => setSearchOpen(false)} />}
    {authPrompt && !authenticated && <AuthPromptOverlay request={authPrompt} onClose={closeAuthPrompt} />}
    {pathname !== "/compare" && <CompareDock products={catalog.products} selected={compare} onClear={() => { compareDirty.current = true; setCompare([]); }} />}
  </MarketplaceContext.Provider>;
}

export function useMarketplace() {
  const context = useContext(MarketplaceContext);
  if (!context) throw new Error("useMarketplace must be used within MarketplaceProvider");
  return context;
}

function SearchOverlay({ catalog, onClose }: { catalog: CatalogLite; onClose: () => void }) {
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
    <section aria-label="Search VialGrade" aria-modal="true" role="dialog" className="ink hard-lg w-full max-w-2xl overflow-hidden rounded-[20px] bg-[var(--surface)]" onMouseDown={(event)=>event.stopPropagation()}>
      <div className="flex items-center gap-3 border-b-2 border-[#111214] px-5 py-4"><Search className="size-5 text-[var(--muted)]" aria-hidden="true"/><input autoFocus value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search compounds, vendors, or listings" className="min-w-0 flex-1 bg-transparent text-[17px] font-medium outline-none placeholder:font-normal placeholder:text-[var(--muted)]" aria-label="Search query"/><button onClick={onClose} className="ink-1 rounded-full bg-white p-2 text-[var(--muted)] transition hover:bg-black/[.04] hover:text-[#111214]" aria-label="Close search"><X className="size-4"/></button></div>
      <div className="max-h-[65vh] overflow-y-auto p-3">{resultCount===0?<div className="px-5 py-14 text-center"><p className="text-lg font-bold text-[#111214]">No matching records</p><p className="mt-2 text-sm font-medium text-[var(--muted)]">Try a compound name, vendor, or quantity.</p></div>:<div className="space-y-5 p-2">
        {results.compounds.length>0&&<SearchSection label="Compounds">{results.compounds.map(compound=><SearchLink key={compound.slug} href={`/compounds/${compound.slug}`} title={compound.name} meta={`${compound.listings} listings · ${compound.coaCount} lab tests`} mark={compound.shorthand} accent={compound.accent[0]} onSelect={onClose}/>)}</SearchSection>}
        {results.products.length>0&&<SearchSection label="Listings">{results.products.map(product=>{const vendor=vendors.find(item=>item.slug===product.vendorSlug);return <SearchLink key={product.slug} href={`/products/${product.slug}`} title={displayProductTitle(product.name,product.quantity)} meta={`${vendor?.name} · $${product.price} · ${product.evidenceLabel}`} mark={product.quantity} accent={product.accent[0]} onSelect={onClose}/>})}</SearchSection>}
        {results.vendors.length>0&&<SearchSection label="Vendors">{results.vendors.map(vendor=><SearchLink key={vendor.slug} href={`/vendors/${vendor.slug}`} title={vendor.name} meta={`${vendor.productCount} products · ${vendor.coaCount} lab tests`} mark={vendor.initials} accent={vendor.accent[0]} onSelect={onClose}/>)}</SearchSection>}
      </div>}</div>
      <div className="flex items-center justify-between border-t-2 border-[#111214] px-5 py-3 text-xs font-semibold text-[var(--muted)]"><span>{catalog.products.some((p) => p.origin === "demo") ? "Demo data unless marked Live" : "Live data from real public sources"}</span><span className="hidden sm:inline">Press Esc to close</span></div>
    </section>
  </div>;
}
function SearchSection({label,children}:{label:string;children:React.ReactNode}){return <div><p className="px-3 pb-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p><div className="space-y-1">{children}</div></div>}
function SearchLink({href,title,meta,mark,accent,onSelect}:{href:string;title:string;meta:string;mark:string;accent:string;onSelect:()=>void}){return <Link href={href} onClick={onSelect} className="group flex items-center gap-3 rounded-[12px] px-3 py-3 transition hover:bg-black/[.05]"><div className="ink grid size-11 shrink-0 place-items-center rounded-[10px] text-[10px] font-extrabold tracking-tight text-white" style={{background:accent}}>{mark}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold tracking-[-0.01em] text-[#111214]">{title}</p><p className="mt-0.5 truncate text-xs font-medium text-[var(--muted)]">{meta}</p></div><span className="translate-x-0 text-sm text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[#111214]">↗</span></Link>}
function CompareDock({products,selected,onClear}:{products:ProductLite[];selected:string[];onClear:()=>void}){if(selected.length===0)return null;const selectedProducts=selected.map(slug=>products.find(product=>product.slug===slug)).filter((product):product is ProductLite=>Boolean(product));return <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[calc(100%-2rem)] max-w-3xl"><div className="flex items-center gap-3 rounded-[18px] ink bg-[#111214] p-2.5 text-white hard-violet"><div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden pl-1">{selectedProducts.map(product=><div key={product.slug} className="flex min-w-0 items-center gap-2 rounded-[10px] bg-white/[.08] px-2.5 py-2"><span className="size-2 shrink-0 rounded-full" style={{background:product.accent[0]}}/><span className="truncate text-xs font-medium">{product.name} {product.quantity}</span></div>)}<span className="hidden shrink-0 text-xs font-medium text-white/50 md:block">{selected.length}/4 selected</span></div><button onClick={onClear} className="rounded-[10px] px-3 py-2 text-xs font-bold text-white/60 transition hover:bg-white/10 hover:text-white">Clear</button><Link href="/compare" className="ink-1 rounded-[10px] bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white/90">Compare</Link></div></div>}
