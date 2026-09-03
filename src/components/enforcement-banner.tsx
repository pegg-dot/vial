import { Gavel, ExternalLink, ShieldAlert, AlertTriangle } from "lucide-react";
import type { RegulatoryActionRow } from "@/server/regulatory/repository";

const AGENCY_LABEL: Record<string, string> = { FDA: "FDA", DOJ: "U.S. DOJ", FTC: "FTC", state: "State", other: "Regulator" };
const TYPE_LABEL: Record<string, string> = { warning_letter: "Warning letter", import_alert: "Import alert", doj_action: "Enforcement action", ftc_action: "FTC action", recall: "Recall", advisory: "Advisory" };

// The loudest, most sourced signal on a vendor page: a public government enforcement record. Every
// row links to its primary source, states the outcome plainly, and never editorializes — it's a
// fact about a government action, not VialGrade's accusation.
export function EnforcementBanner({ actions, vendorName }: { actions: RegulatoryActionRow[]; vendorName: string }) {
  if (actions.length === 0) return null;
  const severe = actions.some((a) => a.severity === "severe");
  const wrap = severe ? "border-[#111214] bg-[#ffecea]" : "border-[#111214] bg-[#fff6e6]";
  const tone = severe ? "text-rose-900" : "text-amber-950";
  return (
    <div className={`hard-sm rounded-[16px] border-2 p-5 sm:p-6 ${wrap} ${tone}`}>
      <div className="flex items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-2xl text-white ${severe ? "bg-[#d3372c]" : "bg-[#b26a00]"}`}>{severe ? <ShieldAlert className="size-5" /> : <Gavel className="size-5" />}</span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.12em] opacity-80">Regulatory &amp; enforcement record</p>
          {/* h3: this banner sits inside the vendor page's "what is flagged right now" section, which
              owns the h2. Level is structural, not stylistic — the size is unchanged. */}
          <h3 className="mt-0.5 text-xl font-semibold tracking-[-.02em]">{severe ? "On a government enforcement record" : `${actions.length} public regulatory record${actions.length === 1 ? "" : "s"}`}</h3>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 opacity-85">These are official public records naming {vendorName} (or an operator VialGrade matched to it). We report the action and link the source; we do not add an accusation of our own.</p>
      <div className="mt-4 space-y-3">
        {actions.map((a) => (
          <div key={a.id} className="rounded-2xl bg-white/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{AGENCY_LABEL[a.agency] ?? a.agency} · {TYPE_LABEL[a.action_type] ?? a.action_type}{a.outcome ? ` · ${a.outcome.replaceAll("_", " ")}` : ""}{a.action_date ? ` · ${a.action_date}` : ""}</p>
                <p className="mt-1 font-semibold">{a.title}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{a.summary}</p>
                {a.match_confidence !== "high" && <p className="mt-1 flex items-center gap-1 text-xs opacity-60"><AlertTriangle className="size-3" /> Named subject: &ldquo;{a.subject_name}&rdquo; — attribution to this vendor is our best match, not confirmed by the agency.</p>}
              </div>
              {a.severity === "severe" ? <span className="shrink-0 rounded-full bg-[#d3372c] px-2.5 py-1 text-[10px] font-bold uppercase text-white">Severe</span> : <span className="shrink-0 rounded-full bg-[#b26a00] px-2.5 py-1 text-[10px] font-bold uppercase text-white">Caution</span>}
            </div>
            <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2">Read the official record <ExternalLink className="size-3" /></a>
          </div>
        ))}
      </div>
    </div>
  );
}
