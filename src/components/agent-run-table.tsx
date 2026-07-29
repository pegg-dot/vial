import type { AgentRun } from "@/lib/types";
import { Check, CircleAlert, LoaderCircle, ShieldX } from "lucide-react";

export function AgentRunTable({ runs }: { runs: AgentRun[] }) {
  return (
    <div className="ink hard overflow-x-auto rounded-[18px] bg-white">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-[#111214] text-[11px] font-extrabold uppercase tracking-[.14em] text-[var(--muted)]">
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
              published: { label: "Published", icon: Check, className: "bg-[#e6fbf4] text-[#0e8f80]" },
              review: { label: "Needs review", icon: CircleAlert, className: "bg-[#fff4e0] text-[#b26a00]" },
              blocked: { label: "Blocked", icon: ShieldX, className: "bg-[#fff1f0] text-[#d3372c]" },
              running: { label: "Running", icon: LoaderCircle, className: "bg-[#f0edff] text-[#2b31d8]" },
            }[run.status];
            const Icon = status.icon;
            return (
              <tr key={run.id} className="border-b border-[#111214]/10 last:border-0">
                <td className="px-5 py-4 align-top">
                  <p className="font-mono text-xs font-bold text-[#111214]">{run.id}</p>
                  <p className="mt-1 text-xs font-medium text-[var(--muted)]">{run.startedAt} · {run.duration}</p>
                </td>
                <td className="px-5 py-4 align-top text-sm font-bold text-[#111214]">{run.workflow}</td>
                <td className="px-5 py-4 align-top text-sm font-medium text-[#111214]/70">{run.target}</td>
                <td className="px-5 py-4 align-top">
                  <div className="flex max-w-[250px] flex-wrap gap-1.5">
                    {run.tools.map((tool) => <span key={tool} className="ink-1 rounded-md bg-white px-2 py-1 font-mono text-[10px] font-semibold text-[#111214]/65">{tool}</span>)}
                  </div>
                  {run.reason && <p className="mt-2 max-w-sm text-xs font-medium leading-5 text-[var(--muted)]">{run.reason}</p>}
                </td>
                <td className="px-5 py-4 align-top text-sm text-[#111214]"><span className="font-extrabold">{run.publishedChanges}</span> / {run.proposedChanges}</td>
                <td className="px-5 py-4 align-top">
                  <span className={`ink-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${status.className}`}>
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
