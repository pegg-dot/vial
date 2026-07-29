"use client";

import {
  Activity,
  BarChart3,
  Boxes,
  Braces,
  CircleDollarSign,
  FileCheck2,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  Menu,
  PackageCheck,
  Plug,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserRoundCog,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/wordmark";

const groups = [
  {
    label: "Operate",
    links: [
      ["/seller", "Overview", LayoutDashboard],
      ["/seller/onboarding", "Onboarding", ShieldCheck],
      ["/seller/integrations", "Connections", Plug],
      ["/seller/imports", "Imports", PackageCheck],
    ],
  },
  {
    label: "Catalog",
    links: [
      ["/seller/catalog", "Products", ShoppingBag],
      ["/seller/batches", "Batches", Boxes],
      ["/seller/evidence", "Evidence", FileCheck2],
      ["/seller/testing", "Testing", FlaskConical],
      ["/seller/inventory", "Inventory", Truck],
    ],
  },
  {
    label: "Business",
    links: [
      ["/seller/orders", "Orders", Activity],
      ["/seller/payments", "Payments", CircleDollarSign],
      ["/seller/payouts", "Payouts", CircleDollarSign],
      ["/seller/disputes", "Disputes", ShieldCheck],
      ["/seller/support", "Support", HeartPulse],
      ["/seller/analytics", "Analytics", BarChart3],
      ["/seller/health", "Marketplace health", PackageCheck],
    ],
  },
  {
    label: "Account",
    links: [
      ["/seller/team", "Team", UsersRound],
      ["/seller/developer", "Developer", Braces],
      ["/seller/settings", "Settings", Settings],
    ],
  },
] as const;

function SideNav({ close }: { close?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Seller workspace" className="space-y-7">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--muted)]">{group.label}</p>
          <div className="space-y-1">
            {group.links.map(([href, label, Icon]) => {
              const active = pathname === href || (href !== "/seller" && pathname.startsWith(`${href}/`));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active ? "ink bg-[#111214] text-white" : "text-[var(--muted)] hover:bg-[#111214]/[.05] hover:text-[#111214]"}`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function SellerShell({ children, sellerName, role, completion = 0, readiness = "blocked" }: { children: React.ReactNode; sellerName: string; role: string; completion?: number; readiness?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <header className="sticky top-0 z-50 border-b-2 border-[#111214] bg-[rgba(247,247,244,.9)] backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center px-5">
          <Wordmark />
          <span className="ml-3 ink-1 rounded-full bg-[#f0edff] px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#6d5dfc]">Seller</span>
          <button className="ml-auto ink grid size-10 place-items-center rounded-full bg-white" aria-label={open ? "Close seller navigation" : "Open seller navigation"} onClick={() => setOpen((value) => !value)}>
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </header>
      {open && <div className="fixed inset-x-0 top-16 z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-b-2 border-[#111214] bg-[#f7f7f4] p-5 shadow-xl lg:hidden"><SideNav close={() => setOpen(false)} /></div>}
      <aside className="fixed inset-y-0 left-0 hidden w-[268px] border-r-2 border-[#111214] bg-[#f2f2ee] p-5 lg:flex lg:flex-col">
        <div className="flex items-center justify-between px-2 py-2">
          <Wordmark />
          <span className="ink-1 rounded-full bg-[#6d5dfc] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[.18em] text-white">Seller</span>
        </div>
        <div className="mt-6 ink hard-sm rounded-[16px] bg-white p-4">
          <p className="truncate font-extrabold text-[#111214]">{sellerName}</p>
          <p className="mt-1 text-xs font-semibold capitalize text-[var(--muted)]">{role.replaceAll("_", " ")}</p>
          <div className="mt-4 flex items-center justify-between text-[11px]"><span className="font-semibold text-[var(--muted)]">Onboarding</span><b className="text-[#111214]">{completion}%</b></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full border border-[#111214] bg-white"><div className="h-full bg-[#6d5dfc]" style={{ width: `${completion}%` }} /></div>
          <p className="mt-2 text-[10px] font-extrabold uppercase tracking-wide text-[#6d5dfc]">{readiness.replaceAll("_", " ")}</p>
        </div>
        <div className="mt-7 flex-1 overflow-y-auto pr-1"><SideNav /></div>
        <div className="mt-5 border-t-2 border-[#111214] pt-4">
          <Link href="/market" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--muted)] hover:bg-[#111214]/[.05] hover:text-[#111214]"><UserRoundCog className="size-4" />View marketplace</Link>
        </div>
      </aside>
      <main className="lg:pl-[268px]">
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
