"use client";

import { Menu, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMarketplace } from "./marketplace-state";
import { Wordmark } from "./wordmark";

const nav = [
  { href: "/verify", label: "Verify" },
  { href: "/market", label: "Market" },
  { href: "/compounds", label: "Compounds" },
  { href: "/vendors", label: "Vendors" },
  { href: "/news", label: "News" },
  { href: "/how-we-check", label: "How we check" },
];

export function SiteHeader({ authenticated = false }: { authenticated?: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { openSearch, watchlist, savedStacks } = useMarketplace();
  const savedCount = watchlist.length + savedStacks.length;
  const items = authenticated ? [{ href: "/for-you", label: "For you" }, ...nav] : nav;

  return (
    <header className="sticky top-0 z-40 border-b-2 border-[#111214] bg-[rgba(247,247,244,.85)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1320px] items-center gap-6 px-5 sm:px-8">
        <Wordmark idPrefix="wmh" />

        {/* The full nav needs ~1200px once the search field and account controls are beside it — at
            md and lg it overflowed, wrapping "How we check" onto three lines and pushing the account
            button off the right edge (iPad landscape is exactly 1024). Below xl the menu carries it. */}
        <nav aria-label="Primary navigation" className="hidden items-center gap-1 xl:flex">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-2 text-sm font-bold transition ${
                  active ? "bg-[#111214] text-white" : "text-[var(--muted)] hover:bg-black/[.06] hover:text-black"
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
            className="ink-1 group hidden h-10 min-w-[210px] items-center gap-2.5 rounded-full bg-white/80 px-3.5 text-left text-sm font-medium text-[var(--muted)] transition hover:-translate-y-0.5 hover:bg-white lg:flex"
          >
            <Search className="size-4" aria-hidden="true" />
            <span className="flex-1">Search the market</span>
            <kbd className="ink-1 rounded-md bg-black/[.035] px-1.5 py-0.5 text-[10px] font-bold">⌘K</kbd>
          </button>
          <button
            onClick={openSearch}
            className="ink-1 grid size-10 place-items-center rounded-full bg-white/80 text-black transition hover:bg-white lg:hidden"
            aria-label="Search the market"
          >
            <Search className="size-4" />
          </button>
          <Link
            href="/watchlist"
            className="ink-1 relative hidden rounded-full bg-white/80 px-4 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 hover:bg-white sm:block"
          >
            Saved
            {savedCount > 0 && (
              <span className="ink-1 absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[#2b31d8] text-[10px] font-bold text-white">{savedCount}</span>
            )}
          </Link>
          {/* Visible at every width. It was `hidden sm:block`, so a signed-out phone visitor had no
              sign-in control in the header — and the account button is exactly what the dismissed
              sign-in prompt hands off to. Below `sm` it collapses to the icon to keep the bar. */}
          <Link
            href={authenticated ? "/account" : "/login"}
            aria-label={authenticated ? "Account" : "Sign in"}
            className="ink hard-sm press grid size-10 place-items-center rounded-full bg-[#111214] text-sm font-bold text-white sm:block sm:size-auto sm:px-5 sm:py-2.5"
          >
            <UserRound className="size-4 sm:hidden" />
            <span className="hidden sm:inline">{authenticated ? "Account" : "Sign in"}</span>
          </Link>
          <button
            onClick={() => setMobileOpen((value) => !value)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="ink-1 grid size-10 place-items-center rounded-full bg-white/80 xl:hidden"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav aria-label="Mobile navigation" className="border-t-2 border-[#111214] bg-[var(--background)] px-5 py-4 xl:hidden">
          <div className="mx-auto grid max-w-[1320px] gap-1">
            {[...items, { href: "/watchlist", label: "Saved" }, { href: "/compare", label: "Compare" }, { href: "/help", label: "Help" }, { href: "/account", label: "Account" }].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-2xl px-4 py-3 text-base font-bold hover:bg-black/[.06]"
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
