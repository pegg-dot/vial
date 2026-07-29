import type { Metadata } from "next";
import { ArrowRight, Boxes, Braces, FileCheck2, PlugZap, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = { title: "Sell on VIAL", description: "A guided, evidence-first seller onboarding workspace." };

export default function SellPage() {
  return <main className="min-h-screen bg-[#f7f7f4]">
    <header className="mx-auto flex max-w-7xl items-center px-5 py-6 sm:px-8"><Wordmark /><Link href="/login?next=/seller/onboarding" className="ink hard-sm press ml-auto inline-flex rounded-full bg-[#111214] px-5 py-2.5 text-sm font-bold text-white">Open seller workspace</Link></header>
    <section className="mx-auto max-w-7xl px-5 pb-24 pt-16 sm:px-8 lg:pt-24">
      <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#6d5dfc]">VIAL for sellers</p>
      <h1 className="mt-5 max-w-5xl text-5xl font-extrabold tracking-[-.065em] sm:text-7xl lg:text-[92px] lg:leading-[.95]">Connect your store.<br />Keep control of every claim.</h1>
      <p className="mt-7 max-w-2xl text-lg font-medium leading-8 text-[var(--muted)]">Import the catalog you already maintain, match products to VIAL’s canonical market graph, connect batch evidence, and prepare one reviewable seller package.</p>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/login?next=/seller/onboarding" className="ink hard-sm-violet press-violet inline-flex h-12 items-center rounded-full bg-[#6d5dfc] px-6 text-sm font-bold text-white">Start sandbox onboarding <ArrowRight className="ml-2 size-4" /></Link><Link href="/how-we-check" className="ink-1 hard-sm press inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-bold text-[#111214]">See how we check listings</Link></div>
      <div className="mt-20 grid gap-5 md:grid-cols-3">{[
        { Icon: PlugZap, title: "Connect", detail: "Shopify, WooCommerce, CSV, website discovery, Stripe Connect, webhooks, or MCP." },
        { Icon: Sparkles, title: "Match", detail: "VIAL proposes canonical compound and quantity mappings with visible confidence and alternatives." },
        { Icon: FileCheck2, title: "Review", detail: "Nothing publishes automatically. Every catalog and evidence relationship stays reviewable." },
      ].map(({ Icon, title, detail }, index) => <div key={String(title)} className="ink-1 hard rounded-[18px] bg-white p-7"><div className="flex items-center justify-between"><div className="ink grid size-12 place-items-center rounded-2xl bg-[#111214] text-white"><Icon className="size-5" /></div><span className="text-xs font-bold text-[var(--muted)]">0{index + 1}</span></div><h2 className="mt-10 text-2xl font-extrabold tracking-[-.04em]">{String(title)}</h2><p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">{String(detail)}</p></div>)} </div>
      <div className="ink hard-violet mt-20 rounded-[20px] bg-[#111214] p-8 text-white sm:p-12"><div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr]"><div><p className="text-xs uppercase tracking-[.18em] text-white/40">Self-serve without blind trust</p><h2 className="mt-4 text-4xl font-extrabold tracking-[-.05em]">Automation proposes.<br />Authorized people decide.</h2></div><div className="grid gap-4 sm:grid-cols-2">{[{Icon:Boxes,label:"Catalog dry runs"},{Icon:ShieldCheck,label:"Readiness gates"},{Icon:Braces,label:"Scoped MCP tools"},{Icon:FileCheck2,label:"Evidence relationships"}].map(({Icon,label})=><div key={String(label)} className="flex items-center gap-3 rounded-[14px] border border-white/12 bg-white/[.04] p-4"><Icon className="size-4 text-[#b7abff]"/><span className="text-sm text-white/75">{String(label)}</span></div>)}</div></div></div>
    </section>
  </main>;
}
