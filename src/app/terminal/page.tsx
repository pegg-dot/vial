import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Radar, ScrollText, TrendingUp } from "lucide-react";
import { requirePrincipal } from "@/server/auth/principal";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { getPublicSignals } from "@/server/intelligence/repository";
import { getPublications } from "@/server/public-repository";
import { getWatchlistSlugs } from "@/server/account/repository";

export const metadata: Metadata = { title: "Research terminal" };
export const dynamic = "force-dynamic";

export default async function TerminalPage() {
  const principal = await requirePrincipal({ accountTypes: ["customer", "seller"] });
  const [catalog, signals, publications, watchlist] = await Promise.all([
    getCatalogSnapshot(),
    getPublicSignals(8),
    getPublications(8),
    getWatchlistSlugs(principal.id),
  ]);

  const movers = catalog.products
    .filter((p) => typeof p.previousPrice === "number" && p.previousPrice > 0 && p.previousPrice !== p.price)
    .map((p) => ({ slug: p.slug, name: p.name, price: p.price, change: ((p.price - (p.previousPrice as number)) / (p.previousPrice as number)) * 100 }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 8);

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Research terminal</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em] text-[#111214] sm:text-5xl">The market, on one screen.</h1>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] font-medium text-[var(--muted)]">
          <span>{catalog.products.length} listings</span><span>·</span><span>{catalog.compounds.length} compounds</span><span>·</span><span>{watchlist.length} watched</span>
        </div>
      </div>

      <form action="/search" className="ink hard mt-6 flex items-center gap-2 rounded-[16px] bg-white px-4 py-3">
        <span className="font-mono text-sm font-bold text-[#2b31d8]">&gt;</span>
        <input name="q" placeholder="query the market — compound, vendor, batch, listing…" className="flex-1 bg-transparent font-mono text-sm font-medium outline-none" />
        <button className="ink hard-sm press rounded-full bg-[#111214] px-4 py-2 text-xs font-bold text-white">Run</button>
      </form>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel icon={TrendingUp} title="Price movement" href="/market" cta="Open market">
          {movers.map((m) => (
            <Row key={m.slug} href={`/products/${m.slug}`} left={<span className="font-mono text-xs">{m.name}</span>} right={<span className={`font-mono text-xs font-bold ${m.change < 0 ? "text-[#0e8f80]" : "text-[#d3372c]"}`}>{m.change > 0 ? "+" : ""}{m.change.toFixed(1)}%</span>} />
          ))}
          {movers.length === 0 && <Empty>No recent price movement.</Empty>}
        </Panel>

        <Panel icon={Radar} title="Live risk signals" href="/signals" cta="All signals">
          {signals.map((s) => (
            <Row key={s.id} href={s.entitySlug ? `/compounds/${s.entitySlug}` : "/signals"} left={<span className="font-mono text-xs">{s.title}</span>} right={<span className="font-mono text-[10px] text-[var(--muted)]">{Math.round(s.score)}</span>} />
          ))}
          {signals.length === 0 && <Empty>No open signals — run the intelligence sweep to populate.</Empty>}
        </Panel>

        <Panel icon={ScrollText} title="Reviewed changes" href="/updates" cta="Full ledger">
          {publications.map((p) => (
            <Row key={p.id} href={`/products/${p.listingSlug}`} left={<span className="font-mono text-xs">{p.productName} · {p.changedFields.join(", ") || "reviewed change"}</span>} right={<span className="font-mono text-[10px] text-[var(--muted)]">v{p.version}</span>} />
          ))}
          {publications.length === 0 && <Empty>No published changes yet.</Empty>}
        </Panel>
      </div>
    </main>
  );
}

function Panel({ icon: Icon, title, href, cta, children }: { icon: React.ComponentType<{ className?: string }>; title: string; href: string; cta: string; children: React.ReactNode }) {
  return (
    <section className="ink hard rounded-[18px] bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Icon className="size-4 text-[#2b31d8]" /><h2 className="text-sm font-extrabold text-[#111214]">{title}</h2></div>
        <Link href={href} className="flex items-center gap-1 text-[11px] font-bold text-[var(--muted)] hover:text-[#111214]">{cta}<ArrowUpRight className="size-3" /></Link>
      </div>
      <div className="mt-4 divide-y divide-[#111214]/10">{children}</div>
    </section>
  );
}
function Row({ href, left, right }: { href: string; left: React.ReactNode; right: React.ReactNode }) {
  return <Link href={href} className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-70">{left}{right}</Link>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-[11px] text-[var(--muted)]">{children}</p>;
}
