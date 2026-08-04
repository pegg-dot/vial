import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Bell, Bookmark, Clock3, History, Search, Sparkles } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { requirePrincipal } from "@/server/auth/principal";
import { getPersonalizedMarket, generateMarketChangeSummary, syncWatchlistNotifications } from "@/server/consumer-intelligence/service";

export const metadata: Metadata = { title: "For you", description: "A personalized VIAL market view based on your follows, watchlist, price, vendor, and evidence preferences." };
export const dynamic = "force-dynamic";

export default async function ForYouPage() {
  const principal = await requirePrincipal({ accountTypes: ["customer", "seller"] });
  // Make the derived surfaces LIVE, not just seeded: refresh this user's alerts and
  // regenerate their "since last review" summary before rendering. Best-effort — it must
  // never break the page — and it runs BEFORE getPersonalizedMarket, which advances the
  // visit cursor that scopes the summary window.
  await Promise.allSettled([
    syncWatchlistNotifications(principal.id),
    generateMarketChangeSummary(principal.id),
  ]);
  const data = await getPersonalizedMarket(principal.id);
  const summary = data.summaries[0];
  const unread = data.notifications.filter((item) => item.status === "unread").length;
  const firstName = principal.displayName.split(" ")[0];

  return (
    <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-12">
      {/* Header */}
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#6d5dfc]">Your feed</p>
          <h1 className="mt-3 text-[clamp(2.2rem,5vw,3.5rem)] font-extrabold leading-[.95] tracking-[-.05em]">Welcome back, {firstName}.</h1>
          <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">The compounds and vendors you follow, what changed since you last looked, and why each pick is here.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Metric icon={Bookmark} value={data.watchlist.length} label="Watched" />
          <Metric icon={Search} value={data.savedSearches.length} label="Searches" />
          <Metric icon={Bell} value={unread} label="Unread" />
        </div>
      </section>

      {/* Since your last review */}
      {summary && (
        <section className="ink hard-violet mt-8 rounded-[20px] bg-[#f0edff] p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <span className="ink grid size-12 shrink-0 place-items-center rounded-2xl bg-[#6d5dfc] text-white"><Sparkles className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#6d5dfc]">Since your last review</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-[-.04em] sm:text-3xl">{summary.title}</h2>
              <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[#4b3fb0]">{summary.summary}</p>
              {summary.items.length > 0 && (
                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {summary.items.slice(0, 4).map((item) => (
                    <Link key={`${item.href}:${item.occurredAt}`} href={item.href} className="group ink-1 press flex items-start justify-between gap-3 rounded-[14px] bg-white p-4">
                      <div>
                        <p className="text-sm font-extrabold">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.detail}</p>
                      </div>
                      <ArrowUpRight className="size-4 shrink-0 text-[var(--muted)] transition group-hover:text-[#111214]" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Picked for you */}
      <section className="mt-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#6d5dfc]">Worth a look</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">Picked for you, with reasons</h2>
          </div>
          <Link href="/account/preferences" className="ink hard-sm press inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-bold">Adjust preferences</Link>
        </div>
        <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.recommendations.map((item) => (
            <div key={item.product.slug} className="flex flex-col gap-2.5">
              <ProductCard product={item.product} />
              {item.reasons.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]">Why</span>
                  {item.reasons.map((reason) => (
                    <span key={reason} className="ink-1 rounded-full bg-[#f0edff] px-2.5 py-1 text-[10px] font-bold text-[#5a4be0]">{reason}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Supporting panels */}
      <section className="mt-12 grid gap-5 lg:grid-cols-3">
        <Panel icon={Search} title="Saved searches" href="/saved-searches" action="Open searches" empty="No saved searches yet">
          {data.savedSearches.slice(0, 3).map((item) => (
            <div key={item.id} className="ink-1 rounded-[14px] bg-[var(--background)] p-4">
              <p className="font-extrabold">{item.name}</p>
              <p className="mt-1 font-mono text-xs text-[var(--muted)]">{item.query}</p>
            </div>
          ))}
        </Panel>
        <Panel icon={Bell} title="Relevant alerts" href="/account/notifications" action="Open inbox" empty="No alerts yet — follow a compound or vendor to get them">
          {data.notifications.slice(0, 3).map((item) => (
            <div key={item.id} className="ink-1 rounded-[14px] bg-[var(--background)] p-4">
              <p className="font-extrabold">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.body}</p>
            </div>
          ))}
        </Panel>
        <Panel icon={History} title="Recently viewed" href="/account/history" action="View history" empty="Nothing viewed yet">
          {data.history.slice(0, 3).map((item) => (
            <div key={item.id} className="ink-1 flex gap-3 rounded-[14px] bg-[var(--background)] p-4">
              <Clock3 className="mt-0.5 size-4 shrink-0 text-[var(--muted)]" />
              <div>
                <p className="font-extrabold capitalize">{item.eventType.replace(/_/g, " ")}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{item.subjectId}</p>
              </div>
            </div>
          ))}
        </Panel>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string }) {
  return (
    <div className="ink hard min-w-[84px] rounded-[16px] bg-white p-4 text-center">
      <Icon className="mx-auto size-4 text-[#6d5dfc]" />
      <p className="mt-2.5 text-2xl font-extrabold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{label}</p>
    </div>
  );
}

function Panel({ icon: Icon, title, href, action, empty, children }: { icon: React.ComponentType<{ className?: string }>; title: string; href: string; action: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(items) ? items.length === 0 : !items;
  return (
    <section className="ink hard flex flex-col rounded-[18px] bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="ink grid size-10 place-items-center rounded-2xl bg-[#111214] text-white"><Icon className="size-4" /></span>
        <h2 className="text-xl font-extrabold tracking-[-.02em]">{title}</h2>
      </div>
      <div className="mt-5 flex-1 space-y-2">
        {isEmpty ? <p className="text-sm font-medium text-[var(--muted)]">{empty}</p> : items}
      </div>
      <Link href={href} className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[#5a4be0]">{action}<ArrowUpRight className="size-3.5" /></Link>
    </section>
  );
}
