import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Boxes, Fingerprint, GitBranch, KeyRound, ScrollText, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Developers — the VIAL registry standard",
  description: "The canonical VIAL ID scheme, the public registry and reputation endpoints, and the versioned methodology third parties cite.",
};

const ID_EXAMPLES = [
  { id: "vial:compound:bpc-157", of: "A compound in the market data spine" },
  { id: "vial:vendor:northstar-research", of: "A vendor / research supplier" },
  { id: "vial:lab:aperture-analytical", of: "A laboratory, sourced from its real profile record" },
  { id: "vial:batch:hx-bpc-2607", of: "A batch, sourced from its published passport" },
];

const ENDPOINTS = [
  { method: "GET", path: "/api/public/v1/id/{vialId}", scope: "identity:read", of: "Resolve a canonical ID to its record — aliases, provenance URL, relationships." },
  { method: "GET", path: "/api/public/v1/resolve?label=&type=", scope: "identity:read", of: "Map a messy real-world label (or a former slug) to a canonical VIAL ID." },
  { method: "GET", path: "/api/public/v1/batches/{vialBatchId}", scope: "market:read", of: "Batch-history record: decomposed confidence + append-only version history." },
  { method: "GET", path: "/api/public/v1/reputation/{vialId}", scope: "reputation:read", of: "Reputation record: decomposable, provenance-linked dimensions — never a score." },
  { method: "GET", path: "/api/public/v1/catalog", scope: "market:read", of: "Published, review-gated catalog projection." },
  { method: "GET", path: "/api/public/v1/signals", scope: "signals:read", of: "Published opportunity/risk signals." },
  { method: "GET", path: "/api/public/v1/export", scope: "export:read", of: "Bounded JSON/CSV export of catalog or signals." },
];

const REPUTATION_DIMENSIONS = [
  { key: "identity_claim", of: "Observed profile claim and participation state." },
  { key: "documentation_currency", of: "Share of listings with current documentation, plus its time series." },
  { key: "evidence_corroboration", of: "Independent laboratory passports linked to the entity; conflicts stay visible." },
  { key: "operational_reliability", of: "Fulfillment/refund rates — or an explicit 'unknown' when unobserved." },
  { key: "community_signal", of: "Moderated, verified-purchase reviews kept as separate ratings." },
  { key: "open_risk_flags", of: "Open, traceable risk signals and fraud cases. Informational only." },
];

export default function DevelopersPage() {
  return (
    <>
      <section className="border-b border-black/[.06]">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Developers · category infrastructure</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-[.94] tracking-[-.065em] sm:text-7xl">Build on the VIAL registry.</h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
            VIAL publishes stable, resolvable identifiers for compounds, vendors, labs, and batches — bound to a versioned provenance and reputation standard. The identifier is the join key the rest of the ecosystem can cite.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/api/openapi.json" className="inline-flex items-center gap-2 rounded-full bg-[#111214] px-4 py-2.5 text-sm font-semibold text-white">OpenAPI document <ArrowUpRight className="size-4" /></Link>
            <Link href="/account/developer" className="inline-flex items-center gap-2 rounded-full border border-black/15 px-4 py-2.5 text-sm font-semibold"><KeyRound className="size-4" /> Get an API key</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-8 sm:py-20">
        <div className="flex items-center gap-2"><Fingerprint className="size-4 text-violet-700" /><h2 className="text-2xl font-semibold tracking-[-.03em]">The VIAL ID scheme</h2></div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Every identifier is <code className="rounded bg-black/[.05] px-1.5 py-0.5 font-mono text-[13px]">vial:&#123;type&#125;:&#123;slug&#125;</code>. IDs are immutable and keyed on stable source identity, not the slug — so a rename keeps the same ID and the former slug still resolves.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <tbody>
              {ID_EXAMPLES.map((row) => (
                <tr key={row.id} className="border-b border-black/[.06]">
                  <td className="py-3 pr-6 align-top"><code className="font-mono text-[13px] text-violet-700">{row.id}</code></td>
                  <td className="py-3 text-[var(--muted)]">{row.of}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-black/[.06] bg-[#faf9f6]">
        <div className="mx-auto max-w-[1120px] px-5 py-14 sm:px-8 sm:py-20">
          <div className="flex items-center gap-2"><Boxes className="size-4 text-violet-700" /><h2 className="text-2xl font-semibold tracking-[-.03em]">Public endpoints</h2></div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">Bearer-authenticated (<code className="rounded bg-black/[.05] px-1.5 py-0.5 font-mono text-[13px]">Authorization: Bearer vial_pk_…</code>), scope-checked, rate-limited, and read-only over published, review-gated data.</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead><tr className="border-b border-black/10 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]"><th className="py-2 pr-4">Endpoint</th><th className="py-2 pr-4">Scope</th><th className="py-2">Returns</th></tr></thead>
              <tbody>
                {ENDPOINTS.map((row) => (
                  <tr key={row.path} className="border-b border-black/[.06]">
                    <td className="py-3 pr-4 align-top"><span className="font-mono text-[12px]"><span className="text-emerald-700">{row.method}</span> {row.path}</span></td>
                    <td className="py-3 pr-4 align-top"><code className="rounded bg-violet-50 px-1.5 py-0.5 font-mono text-[12px] text-violet-700">{row.scope}</code></td>
                    <td className="py-3 text-[var(--muted)]">{row.of}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-2"><GitBranch className="size-4 text-violet-700" /><h2 className="text-2xl font-semibold tracking-[-.03em]">Batch history is versioned</h2></div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">A cited passport is a record, not a mutable row. Every material change appends an immutable version, and the headline confidence is decomposed into its basis — which labs, sampling independence, methods, and the established / conflicting / unknown split. Disagreement between independent samples is preserved, never averaged away.</p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">An accredited laboratory can attach corroborating evidence to a batch by posting to <code className="rounded bg-black/[.05] px-1.5 py-0.5 font-mono text-[12px]">/api/public/v1/id/&#123;vialId&#125;/evidence-proposals</code> with an <code className="rounded bg-black/[.05] px-1.5 py-0.5 font-mono text-[12px]">evidence:propose</code> token. Submissions land in human review — they never publish automatically.</p>
          </div>
          <div>
            <div className="flex items-center gap-2"><ScrollText className="size-4 text-violet-700" /><h2 className="text-2xl font-semibold tracking-[-.03em]">Reputation, methodology {`reputation-v1`}</h2></div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">A reputation record is a set of dated, provenance-linked dimensions — <span className="font-semibold text-black/70">never a composite score</span>. Where evidence is absent, the record shows &ldquo;unknown&rdquo; rather than inventing a number.</p>
            <ul className="mt-4 space-y-2">
              {REPUTATION_DIMENSIONS.map((d) => (
                <li key={d.key} className="flex gap-2 text-sm"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-black/30" /><span><code className="font-mono text-[12px] text-violet-700">{d.key}</code> — <span className="text-[var(--muted)]">{d.of}</span></span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-black/[.06]">
        <div className="mx-auto max-w-[1120px] px-5 py-12 sm:px-8">
          <p className="text-sm leading-6 text-[var(--muted)]">All data is fictional and for demonstration. The registry publishes only reviewed events and issued reports. No endpoint can publish, approve evidence, or move money — every public scope is read-only.</p>
        </div>
      </section>
    </>
  );
}
