"use client";

import { ArrowRight, Check, CircleAlert, CircleDashed, ExternalLink, Search, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { VerifyResult, Verdict } from "@/server/verify";

const VERDICT: Record<Verdict, { label: string; cls: string; icon: typeof Check }> = {
  trusted: { label: "Trusted", cls: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: ShieldCheck },
  info: { label: "Info", cls: "bg-violet-50 text-violet-800 border-violet-200", icon: Search },
  caution: { label: "Caution", cls: "bg-amber-50 text-amber-800 border-amber-200", icon: CircleAlert },
  unproven: { label: "Unproven", cls: "bg-amber-50 text-amber-800 border-amber-200", icon: CircleDashed },
  "high-risk": { label: "High risk", cls: "bg-rose-50 text-rose-800 border-rose-200", icon: CircleAlert },
  avoid: { label: "Avoid", cls: "bg-rose-50 text-rose-800 border-rose-200", icon: X },
};

const SUGGESTIONS = ["bluumpeptides.com", "BPC-157", "Peptide Sciences", "F8IKXANLGX1R"];

export default function VerifyPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(q: string) {
    const value = q.trim();
    if (!value) return;
    setPending(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/v1/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: value }) });
      if (!res.ok) { setError("Something went wrong — try again."); return; }
      setResult(await res.json());
    } catch { setError("Something went wrong — try again."); }
    finally { setPending(false); }
  }

  return (
    <section className="mx-auto max-w-[820px] px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Verify anything</p>
      <h1 className="mt-3 text-5xl font-semibold leading-[.98] tracking-[-.06em] sm:text-6xl">Check it before you buy.</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">Paste a vendor, a website, a compound, or a Janoshik COA code. We&rsquo;ll tell you what we know — and if we&rsquo;ve never seen it, we run a live check so &ldquo;unknown&rdquo; is never mistaken for &ldquo;safe.&rdquo;</p>

      <form onSubmit={(e) => { e.preventDefault(); void check(query); }} className="mt-8 flex flex-col gap-2 rounded-[24px] border border-black/[.09] bg-white p-2 shadow-[0_14px_40px_rgba(18,20,24,.07)] sm:flex-row">
        <label className="flex min-h-13 flex-1 items-center gap-3 rounded-2xl bg-black/[.035] px-4">
          <Search className="size-5 text-black/40" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="vendor.com, BPC-157, or a COA code" className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:font-normal placeholder:text-black/35" aria-label="Check a vendor, compound, or COA" />
        </label>
        <button disabled={pending} className="flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#111214] px-6 text-sm font-semibold text-white transition hover:bg-black/85 disabled:opacity-60">{pending ? "Checking…" : "Check"} <ArrowRight className="size-4" /></button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        Try:
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => { setQuery(s); void check(s); }} className="rounded-full border border-black/[.09] bg-white px-2.5 py-1 font-mono font-medium hover:border-black/[.2]">{s}</button>
        ))}
      </div>

      {error && <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {result && (() => {
        const v = VERDICT[result.verdict]; const Icon = v.icon;
        return (
          <div className="mt-8">
            <div className={`rounded-[24px] border p-6 ${v.cls}`}>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em]"><Icon className="size-4" /> {v.label}</div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-.03em]">{result.headline}</h2>
              <p className="mt-2 text-sm leading-6 opacity-90">{result.summary}</p>
              {result.link && (
                <a href={result.link.href} target={result.link.href.startsWith("http") ? "_blank" : undefined} rel={result.link.href.startsWith("http") ? "noopener nofollow" : undefined} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4">
                  {result.link.label} {result.link.href.startsWith("http") ? <ExternalLink className="size-3.5" /> : <ArrowRight className="size-3.5" />}
                </a>
              )}
            </div>

            {result.signals.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-[20px] border border-black/[.07] bg-white">
                {result.signals.map((s, i) => (
                  <div key={s.label} className={`flex items-start gap-3 px-5 py-4 ${i > 0 ? "border-t border-black/[.06]" : ""}`}>
                    <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${s.ok === true ? "bg-emerald-100 text-emerald-700" : s.ok === false ? "bg-rose-100 text-rose-700" : "bg-black/[.06] text-black/45"}`}>
                      {s.ok === true ? <Check className="size-3.5" /> : s.ok === false ? <X className="size-3.5" /> : <CircleDashed className="size-3.5" />}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{s.label}</p>
                      <p className="mt-0.5 text-sm leading-5 text-[var(--muted)]">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.alternatives && result.alternatives.length > 0 && (
              <div className="mt-4 rounded-[20px] border border-black/[.07] bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--muted)]">Trusted vendors instead</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.alternatives.map((a) => (
                    <Link key={a.slug} href={`/vendors/${a.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-black/[.1] bg-white px-3 py-1.5 text-sm font-semibold hover:border-black/[.24]">{a.name} <ArrowRight className="size-3.5" /></Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </section>
  );
}
