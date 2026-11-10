import { Gavel, ArrowUpRight, ShieldAlert, AlertTriangle } from "lucide-react";
import type { RegulatoryActionRow } from "@/server/regulatory/repository";
import { Chip, Frame, Quiet, UI } from "@/components/intelligence/research-ui";

const AGENCY_LABEL: Record<string, string> = { FDA: "FDA", DOJ: "U.S. DOJ", FTC: "FTC", state: "State", other: "Regulator" };
const TYPE_LABEL: Record<string, string> = { warning_letter: "Warning letter", import_alert: "Import alert", doj_action: "Enforcement action", ftc_action: "FTC action", recall: "Recall", advisory: "Advisory" };

// The loudest, most sourced signal on a vendor page: a public government enforcement record. Every
// row links to its primary source, states the outcome plainly, and never editorializes — it's a
// fact about a government action, not VialGrade's accusation.
export function EnforcementBanner({ actions, vendorName }: { actions: RegulatoryActionRow[]; vendorName: string }) {
  if (actions.length === 0) return null;
  const severe = actions.some((a) => a.severity === "severe");
  const tone = severe ? "danger" : "warn";
  return (
    <Frame tone={tone} shadow="sm" radius="rounded-[16px]">
      <Chip tone={tone} icon={severe ? ShieldAlert : Gavel}>Regulatory &amp; enforcement record</Chip>
      {/* h3: this banner sits inside the vendor page's "what is flagged right now" section, which
          owns the h2. Level is structural, not stylistic. */}
      <h3 className={UI.h3 + " mt-3"}>{severe ? "On a government enforcement record" : `${actions.length} public regulatory record${actions.length === 1 ? "" : "s"}`}</h3>
      <p className={UI.bodyInk + " mt-3"}>These are official public records naming {vendorName} (or an operator VialGrade matched to it). We report the action and link the source; we do not add an accusation of our own.</p>
      <div className="mt-4 space-y-3">
        {actions.map((a) => (
          <Quiet key={a.id} as="article">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={UI.eyebrowMuted}>{AGENCY_LABEL[a.agency] ?? a.agency} · {TYPE_LABEL[a.action_type] ?? a.action_type}{a.outcome ? ` · ${a.outcome.replaceAll("_", " ")}` : ""}{a.action_date ? ` · ${a.action_date}` : ""}</p>
                <p className={UI.h4 + " mt-1"}>{a.title}</p>
                <p className={UI.bodyInk + " mt-1"}>{a.summary}</p>
                {a.match_confidence !== "high" && <p className={UI.small + " mt-1 flex items-start gap-1"}><AlertTriangle className="mt-1 size-3 shrink-0" aria-hidden="true" /> Named subject: &ldquo;{a.subject_name}&rdquo; — attribution to this vendor is our best match, not confirmed by the agency.</p>}
              </div>
              <Chip tone={a.severity === "severe" ? "danger" : "warn"} className="shrink-0">{a.severity === "severe" ? "Severe" : "Caution"}</Chip>
            </div>
            <a href={a.source_url} target="_blank" rel="noopener noreferrer" className={UI.linkSmall + " mt-3"}>Read the official record <ArrowUpRight className="size-3.5" aria-hidden="true" /></a>
          </Quiet>
        ))}
      </div>
    </Frame>
  );
}
