import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, FlaskConical, PackageSearch, Users } from "lucide-react";
import { getSamplingStats } from "@/server/public-repository";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Independent testing", description: "Who selected the sample — blind vs vendor-submitted — across the certificates VialGrade aggregates.", alternates: { canonical: "/testing" } };

export default async function Page() {
  const s = await getSamplingStats();
  const pct = (n: number) => (s.total > 0 ? Math.round((n / s.total) * 100) : 0);
  const models: [string, typeof FlaskConical, string, string, string | null][] = [
    ["S1", FlaskConical, "Vendor selected", "The vendor controls which unit reaches the laboratory.", `${s.vendorSelected} on record · ${pct(s.vendorSelected)}%`],
    ["S2", PackageSearch, "Customer sealed", "A customer submits a sealed unit with documented custody.", null],
    ["S3", EyeOff, "Blind purchase", "An independent sampler buys without the seller choosing the unit — the strongest signal.", `${s.blind} on record · ${pct(s.blind)}%`],
    ["S4", Users, "Multi-source agreement", "Separately sourced samples produce consistent observations.", null],
  ];
  return <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-24">
    <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#0e8f80]">Independent testing</p>
    <h1 className="mt-4 max-w-5xl text-5xl font-extrabold tracking-[-.065em] sm:text-7xl">The question is not only what passed. It is who selected the sample.</h1>
    <p className="mt-6 max-w-3xl text-base font-medium leading-7 text-[var(--muted)]">A certificate is only as strong as how its sample was chosen. Across the {s.total} certificates VialGrade aggregates, here is how many were sampled each way. We don&rsquo;t run these tests &mdash; we surface who did and how the sample was obtained.</p>
    <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{models.map(([code, Icon, title, text, stat]) =>
      <div key={code} className="ink-1 hard rounded-[18px] bg-white p-6">
        <span className="ink-1 grid size-11 place-items-center rounded-2xl bg-[#e6fbf4]"><Icon className="size-5 text-[#0e8f80]" /></span>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[.16em] text-[#0e8f80]">{code}</p>
        <h2 className="mt-2 text-xl font-extrabold">{title}</h2>
        <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">{text}</p>
        <p className="mt-4 text-sm font-extrabold tabular-nums">{stat ?? <span className="font-medium text-[var(--muted)]">Not applicable to aggregated COAs</span>}</p>
      </div>)}
    </div>
    <div className="ink-1 hard mt-14 rounded-[20px] bg-[#faf9f6] p-7">
      <h2 className="text-3xl font-extrabold tracking-[-.04em]">What we can say from the corpus</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="ink-1 rounded-[14px] bg-white p-5"><p className="text-xs font-medium text-[var(--muted)]">Certificates</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{s.total}</p></div>
        <div className="ink-1 rounded-[14px] bg-white p-5"><p className="text-xs font-medium text-[var(--muted)]">Blind-tested</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{s.blind} <span className="text-sm font-medium text-[var(--muted)]">({pct(s.blind)}%)</span></p></div>
        <div className="ink-1 rounded-[14px] bg-white p-5"><p className="text-xs font-medium text-[var(--muted)]">Batch test records</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{s.passports}</p></div>
      </div>
      <p className="mt-5 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">Most certificates in any grey-market corpus are vendor-selected &mdash; the seller chose the unit. A blind result carries more weight because no one could hand-pick the sample. We label which is which on every certificate rather than treating them as equal.</p>
    </div>
    <Link href="/passports" className="ink hard-sm press mt-10 inline-flex rounded-full bg-[#111214] px-6 py-3 text-sm font-bold text-white">View resulting passports</Link>
  </div>;
}
