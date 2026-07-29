import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";

// Seller workspace — hard design system, VIOLET signature (#6d5dfc). Thick ink borders, hard
// offset shadows, flat fills, bold type. Every seller page is composed from these primitives.

export function SellerPageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="flex flex-col gap-5 border-b-2 border-[#111214] pb-8 md:flex-row md:items-end md:justify-between"><div><p className="text-[11px] font-extrabold uppercase tracking-[.19em] text-[#6d5dfc]">{eyebrow ?? "Seller workspace"}</p><h1 className="mt-3 text-4xl font-extrabold tracking-[-.045em] text-[#111214] sm:text-5xl">{title}</h1>{description && <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">{description}</p>}</div>{action}</div>;
}

export function StatCard({ label, value, detail, tone = "default" }: { label: string; value: React.ReactNode; detail?: string; tone?: "default" | "violet" | "dark" }) {
  const style = tone === "dark" ? "bg-[#111214] text-white hard" : tone === "violet" ? "bg-[#f0edff] text-[#111214] hard-violet" : "bg-white text-[#111214] hard";
  const muted = tone === "dark" ? "text-white/55" : "text-[var(--muted)]";
  return <div className={`ink rounded-[18px] p-5 ${style}`}><p className={`text-[11px] font-bold uppercase tracking-[.1em] ${muted}`}>{label}</p><div className="mt-3 text-3xl font-extrabold tracking-[-.04em]">{value}</div>{detail && <p className={`mt-2 text-xs font-medium leading-5 ${muted}`}>{detail}</p>}</div>;
}

export function Panel({ id, title, description, children, action, className = "" }: { id?: string; title?: string; description?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return <section id={id} className={`ink hard rounded-[20px] bg-white p-5 sm:p-6 ${className}`}><div className="flex items-start justify-between gap-4">{title || description ? <div>{title && <h2 className="text-lg font-extrabold tracking-[-.025em] text-[#111214]">{title}</h2>}{description && <p className="mt-1 text-sm font-medium leading-6 text-[var(--muted)]">{description}</p>}</div> : <span />}{action}</div><div className={title || description ? "mt-5" : ""}>{children}</div></section>;
}

export function StatusPill({ status }: { status: string }) {
  const value = status.toLowerCase();
  const style = value.includes("complete") || value.includes("active") || value.includes("ready") || value.includes("connected") || value.includes("confirmed") || value.includes("succeeded") ? "bg-[#e6fbf4] text-[#0e8f80]" : value.includes("block") || value.includes("reject") || value.includes("fail") || value.includes("suspend") ? "bg-[#fff1f0] text-[#d3372c]" : value.includes("review") || value.includes("attention") || value.includes("pending") || value.includes("proposed") ? "bg-[#fff4e0] text-[#b26a00]" : "bg-[#f0f0ec] text-[var(--muted)]";
  return <span className={`ink-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.08em] ${style}`}>{status.replaceAll("_", " ")}</span>;
}

export function ReadinessRow({ label, status, detail, score }: { label: string; status: string; detail: string; score: number }) {
  const Icon = status === "complete" ? CheckCircle2 : status === "blocked" ? CircleAlert : CircleDashed;
  return <div className="flex items-start gap-3 border-b border-[#111214]/10 py-4 last:border-0"><Icon className={`mt-0.5 size-5 shrink-0 ${status === "complete" ? "text-[#0e8f80]" : status === "blocked" ? "text-[#d3372c]" : "text-[#b26a00]"}`} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="font-bold text-[#111214]">{label}</p><span className="text-xs font-extrabold text-[var(--muted)]">{Math.round(score * 100)}%</span></div><p className="mt-1 text-sm font-medium leading-5 text-[var(--muted)]">{detail}</p></div></div>;
}

export const primaryButton = "ink hard-sm-violet press-violet inline-flex min-h-11 items-center justify-center rounded-full bg-[#6d5dfc] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40";
export const secondaryButton = "ink-1 hard-sm press inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#111214]";
