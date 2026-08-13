"use client";

import { ArrowRight, ArrowUpRight, Check, CircleAlert, CircleDashed, ExternalLink, ScanLine, Search, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { VerifyResult, Verdict } from "@/server/verify";
import { VialBuddy, ArtMagnifierVial, ArtMolecule } from "@/components/vial-art";
import { TierChip } from "@/components/signal-tier-chip";
import { signalLabel } from "@/lib/signal-copy";

// Verdict styling — hardened, semantic. Each result card is ink-bordered with a hard shadow.
const VERDICT: Record<Verdict, { label: string; bg: string; accent: string; shadow: string; icon: typeof Check }> = {
  trusted: { label: "Trusted", bg: "bg-[#e6fbf6]", accent: "#0e8f80", shadow: "hard", icon: ShieldCheck },
  info: { label: "Info", bg: "bg-[#eef0ff]", accent: "#2b31d8", shadow: "hard-blue", icon: Search },
  caution: { label: "Caution", bg: "bg-[#fff6e6]", accent: "#b26a00", shadow: "hard", icon: CircleAlert },
  unproven: { label: "Unproven", bg: "bg-[#fff6e6]", accent: "#b26a00", shadow: "hard", icon: CircleDashed },
  "high-risk": { label: "High risk", bg: "bg-[#ffecea]", accent: "#d3372c", shadow: "hard", icon: CircleAlert },
  avoid: { label: "Avoid", bg: "bg-[#ffecea]", accent: "#d3372c", shadow: "hard", icon: X },
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
    <>
      {/* Signature block: deep royal-blue, the boldest page — it's the core action. */}
      <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-[#2b31d8] text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <ArtMagnifierVial className="gum-float absolute left-[4%] top-[14%] hidden w-24 drop-shadow-[5px_5px_0_#111214] md:block lg:w-32" />
          <VialBuddy className="gum-float-slow absolute right-[5%] top-[16%] hidden w-20 drop-shadow-[5px_5px_0_#111214] sm:block lg:w-24" liquid="#8fffd6" cap="#111214" />
          <ArtMolecule className="gum-float-rev absolute right-[13%] bottom-[12%] hidden w-20 drop-shadow-[4px_4px_0_#111214] lg:block" a="#8fffd6" b="#fff" c="#ffb787" />
        </div>

        <div className="mx-auto max-w-[820px] px-5 py-20 text-center sm:px-8 sm:py-24">
          <div className="ink hard-sm mx-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-[#2b31d8]">
            <ScanLine className="size-3.5" /> Verify anything
          </div>
          <h1 className="mt-7 text-balance text-[clamp(3rem,8vw,6rem)] font-extrabold leading-[.86] tracking-[-.05em]">Check it before you buy.</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg font-medium leading-8 text-white/85">
            Paste a vendor, a website, a compound, or a Janoshik COA code. We&rsquo;ll tell you what we know &mdash; and if we&rsquo;ve never seen it, we run a live check so &ldquo;unknown&rdquo; is never mistaken for &ldquo;safe.&rdquo;
          </p>

          <form onSubmit={(e) => { e.preventDefault(); void check(query); }} className="ink hard mx-auto mt-9 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 text-left sm:flex-row">
            <label className="flex min-h-14 flex-1 items-center gap-3 rounded-xl bg-[var(--background)] px-4">
              <Search className="size-5 text-[#2b31d8]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="vendor.com, BPC-157, a COA code, or a verify link" className="min-w-0 flex-1 bg-transparent text-base font-medium text-[#111214] outline-none placeholder:font-normal placeholder:text-black/35" aria-label="Check a vendor, compound, or COA" />
            </label>
            <button disabled={pending} className="ink press flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#111214] px-7 text-sm font-bold text-white disabled:opacity-60">{pending ? "Checking…" : "Check"} <ArrowRight className="size-4" /></button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-white/70">
            Try:
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => { setQuery(s); void check(s); }} className="ink-1 rounded-full bg-white px-3 py-1 font-mono text-[#111214] transition hover:-translate-y-0.5">{s}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[820px] px-5 py-14 sm:px-8 sm:py-16">
        {error && <p className="ink hard-sm rounded-2xl bg-[#ffecea] px-4 py-3 text-sm font-semibold text-[#d3372c]">{error}</p>}

        {!result && !error && !pending && (
          <div className="ink rounded-[22px] bg-white p-8 text-center sm:p-10">
            <div className="ink-1 mx-auto grid size-16 place-items-center rounded-2xl bg-[#eef0ff]"><ArtMagnifierVial className="w-10" /></div>
            <p className="mt-5 text-lg font-bold">Nothing checked yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[var(--muted)]">Paste something above, or tap one of the examples. We&rsquo;ll cross-check it against lab records, reputation, and public enforcement.</p>
          </div>
        )}

        {result && (() => {
          const v = VERDICT[result.verdict]; const Icon = v.icon;
          return (
            <div>
              <div className={`ink ${v.shadow} rounded-[22px] p-7 ${v.bg}`}>
                <div className="ink inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: v.accent }}><Icon className="size-4" /> {v.label}</div>
                <h2 className="mt-4 text-3xl font-extrabold tracking-[-.03em]">{result.headline}</h2>
                <p className="mt-2 text-[15px] font-medium leading-7 text-[#111214]/75">{result.summary}</p>
                {result.link && (
                  <a href={result.link.href} target={result.link.href.startsWith("http") ? "_blank" : undefined} rel={result.link.href.startsWith("http") ? "noopener nofollow" : undefined} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold underline underline-offset-4" style={{ color: v.accent }}>
                    {result.link.label} {result.link.href.startsWith("http") ? <ExternalLink className="size-3.5" /> : <ArrowRight className="size-3.5" />}
                  </a>
                )}
              </div>

              {result.signals.length > 0 && (
                <div className="ink hard mt-5 overflow-hidden rounded-[20px] bg-white">
                  {result.signals.map((s, i) => (
                    <div key={s.label} className={`flex items-start gap-3 px-5 py-4 ${i > 0 ? "border-t-2 border-[#111214]/[.08]" : ""}`}>
                      <span className={`ink-1 mt-0.5 grid size-6 shrink-0 place-items-center rounded-md ${s.ok === true ? "bg-[#12b3a6] text-white" : s.ok === false ? "bg-[#f5463d] text-white" : "bg-[var(--background)] text-black/45"}`}>
                        {s.ok === true ? <Check className="size-3.5" /> : s.ok === false ? <X className="size-3.5" /> : <CircleDashed className="size-3.5" />}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-bold">{signalLabel(s.label)}</p>
                          {s.confidence && <TierChip tier={s.confidence} />}
                        </div>
                        <p className="mt-0.5 text-sm font-medium leading-5 text-[var(--muted)]">{s.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {result.alternatives && result.alternatives.length > 0 && (
                <div className="ink hard mt-5 rounded-[20px] bg-white p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#2b31d8]">Trusted vendors instead</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.alternatives.map((a) => (
                      <Link key={a.slug} href={`/vendors/${a.slug}`} className="ink-1 press inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-bold">{a.name} <ArrowUpRight className="size-3.5" /></Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </section>
    </>
  );
}
