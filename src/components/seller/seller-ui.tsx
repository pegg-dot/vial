import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";

export function SellerPageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="flex flex-col gap-5 border-b border-black/[.07] pb-8 md:flex-row md:items-end md:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.19em] text-violet-600">{eyebrow ?? "Seller workspace"}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">{title}</h1>{description && <p className="mt-3 max-w-2xl text-sm leading-6 text-black/50">{description}</p>}</div>{action}</div>;
}

export function StatCard({ label, value, detail, tone = "default" }: { label: string; value: React.ReactNode; detail?: string; tone?: "default" | "violet" | "dark" }) {
  const style = tone === "dark" ? "bg-[#111214] text-white border-white/10" : tone === "violet" ? "bg-violet-50 border-violet-100" : "bg-white border-black/[.07]";
  return <div className={`rounded-[26px] border p-5 shadow-[0_1px_2px_rgba(0,0,0,.025)] ${style}`}><p className={`text-xs ${tone === "dark" ? "text-white/50" : "text-black/45"}`}>{label}</p><div className="mt-3 text-3xl font-semibold tracking-[-.04em]">{value}</div>{detail && <p className={`mt-2 text-xs leading-5 ${tone === "dark" ? "text-white/45" : "text-black/45"}`}>{detail}</p>}</div>;
}

export function Panel({ id, title, description, children, action, className = "" }: { id?: string; title?: string; description?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return <section id={id} className={`rounded-[28px] border border-black/[.07] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,.025)] sm:p-6 ${className}`}><div className="flex items-start justify-between gap-4">{title || description ? <div>{title && <h2 className="text-lg font-semibold tracking-[-.025em]">{title}</h2>}{description && <p className="mt-1 text-sm leading-6 text-black/45">{description}</p>}</div> : <span />}{action}</div><div className={title || description ? "mt-5" : ""}>{children}</div></section>;
}

export function StatusPill({ status }: { status: string }) {
  const value = status.toLowerCase();
  const style = value.includes("complete") || value.includes("active") || value.includes("ready") || value.includes("connected") || value.includes("confirmed") || value.includes("succeeded") ? "bg-emerald-50 text-emerald-700" : value.includes("block") || value.includes("reject") || value.includes("fail") || value.includes("suspend") ? "bg-rose-50 text-rose-700" : value.includes("review") || value.includes("attention") || value.includes("pending") || value.includes("proposed") ? "bg-amber-50 text-amber-700" : "bg-black/[.055] text-black/55";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${style}`}>{status.replaceAll("_", " ")}</span>;
}

export function ReadinessRow({ label, status, detail, score }: { label: string; status: string; detail: string; score: number }) {
  const Icon = status === "complete" ? CheckCircle2 : status === "blocked" ? CircleAlert : CircleDashed;
  return <div className="flex items-start gap-3 border-b border-black/[.055] py-4 last:border-0"><Icon className={`mt-0.5 size-5 shrink-0 ${status === "complete" ? "text-emerald-600" : status === "blocked" ? "text-rose-500" : "text-amber-500"}`} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="font-medium">{label}</p><span className="text-xs font-semibold text-black/40">{Math.round(score * 100)}%</span></div><p className="mt-1 text-sm leading-5 text-black/45">{detail}</p></div></div>;
}

export const primaryButton = "inline-flex min-h-11 items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-40";
export const secondaryButton = "inline-flex min-h-11 items-center justify-center rounded-full border border-black/[.09] bg-white px-5 py-2.5 text-sm font-semibold transition hover:bg-black/[.035]";
