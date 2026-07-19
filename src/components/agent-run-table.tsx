import type { AgentRun } from "@/lib/types";
import { Check, CircleAlert, LoaderCircle, ShieldX } from "lucide-react";

export function AgentRunTable({ runs }: { runs: AgentRun[] }) {
  return (
    <div className="overflow-x-auto rounded-[24px] border border-black/[.07] bg-white">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead>
          <tr className="border-b border-black/[.07] text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--muted)]">
            <th className="px-5 py-4">Run</th>
            <th className="px-5 py-4">Workflow</th>
            <th className="px-5 py-4">Target</th>
            <th className="px-5 py-4">Tools</th>
            <th className="px-5 py-4">Changes</th>
            <th className="px-5 py-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const status = {
              published: { label: "Published", icon: Check, className: "bg-emerald-50 text-emerald-700" },
              review: { label: "Needs review", icon: CircleAlert, className: "bg-amber-50 text-amber-700" },
              blocked: { label: "Blocked", icon: ShieldX, className: "bg-rose-50 text-rose-700" },
              running: { label: "Running", icon: LoaderCircle, className: "bg-violet-50 text-violet-700" },
            }[run.status];
            const Icon = status.icon;
            return (
              <tr key={run.id} className="border-b border-black/[.055] last:border-0">
                <td className="px-5 py-4 align-top">
                  <p className="font-mono text-xs font-semibold">{run.id}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{run.startedAt} · {run.duration}</p>
                </td>
                <td className="px-5 py-4 align-top text-sm font-semibold">{run.workflow}</td>
                <td className="px-5 py-4 align-top text-sm text-black/70">{run.target}</td>
                <td className="px-5 py-4 align-top">
                  <div className="flex max-w-[250px] flex-wrap gap-1.5">
                    {run.tools.map((tool) => <span key={tool} className="rounded-md bg-black/[.045] px-2 py-1 font-mono text-[10px] text-black/55">{tool}</span>)}
                  </div>
                  {run.reason && <p className="mt-2 max-w-sm text-xs leading-5 text-[var(--muted)]">{run.reason}</p>}
                </td>
                <td className="px-5 py-4 align-top text-sm"><span className="font-semibold">{run.publishedChanges}</span> / {run.proposedChanges}</td>
                <td className="px-5 py-4 align-top">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>
                    <Icon className={`size-3 ${run.status === "running" ? "animate-spin" : ""}`} /> {status.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
