"use client";

import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMarketplace } from "./marketplace-state";
import { Wordmark } from "./wordmark";

const nav = [
  { href: "/market", label: "Market" },
  { href: "/compounds", label: "Compounds" },
  { href: "/vendors", label: "Vendors" },
  { href: "/how-we-check", label: "How we check" },
];

export function SiteHeader({ authenticated = false }: { authenticated?: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { openSearch, watchlist } = useMarketplace();
  const items = authenticated ? [{ href: "/for-you", label: "For you" }, ...nav] : nav;

  return (
    <header className="sticky top-0 z-40 border-b border-black/[.06] bg-[rgba(247,247,244,.84)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1320px] items-center gap-6 px-5 sm:px-8">
        <Wordmark />

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                  active ? "bg-black/[.06] text-black" : "text-[var(--muted)] hover:bg-black/[.035] hover:text-black"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={openSearch}
            className="group hidden h-10 min-w-[210px] items-center gap-2.5 rounded-full border border-black/[.08] bg-white/70 px-3.5 text-left text-sm text-[var(--muted)] shadow-[0_1px_2px_rgba(0,0,0,.03)] transition hover:border-black/[.14] hover:bg-white lg:flex"
          >
            <Search className="size-4" aria-hidden="true" />
            <span className="flex-1">Search the market</span>
            <kbd className="rounded-md border border-black/[.08] bg-black/[.035] px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
          </button>
          <button
            onClick={openSearch}
            className="grid size-10 place-items-center rounded-full border border-black/[.08] bg-white/70 text-black transition hover:bg-white lg:hidden"
            aria-label="Search the market"
          >
            <Search className="size-4" />
          </button>
          <Link
            href="/watchlist"
            className="relative hidden rounded-full border border-black/[.08] bg-white/70 px-4 py-2.5 text-sm font-semibold transition hover:bg-white sm:block"
          >
            Saved
            {watchlist.length > 0 && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-black text-[10px] text-white">{watchlist.length}</span>
            )}
          </Link>
          <Link href={authenticated ? "/account" : "/login"} className="hidden rounded-full bg-[#111214] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black/85 sm:block">
            {authenticated ? "Account" : "Sign in"}
          </Link>
          <button
            onClick={() => setMobileOpen((value) => !value)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="grid size-10 place-items-center rounded-full border border-black/[.08] bg-white/70 md:hidden"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav aria-label="Mobile navigation" className="border-t border-black/[.06] bg-[var(--background)] px-5 py-4 md:hidden">
          <div className="mx-auto grid max-w-[1320px] gap-1">
            {[...items, { href: "/watchlist", label: "Saved" }, { href: "/compare", label: "Compare" }, { href: "/help", label: "Help" }, { href: "/account", label: "Account" }].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-2xl px-4 py-3 text-base font-medium hover:bg-black/[.04]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
