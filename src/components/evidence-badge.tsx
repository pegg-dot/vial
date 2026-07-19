import { Check, CircleAlert, CircleDashed, FlaskConical } from "lucide-react";
import type { EvidenceLevel } from "@/lib/types";
import { evidenceTone } from "@/lib/format";

export function EvidenceBadge({ level, label }: { level: EvidenceLevel; label: string }) {
  const tone = evidenceTone(level);
  const Icon =
    level === "independent"
      ? FlaskConical
      : level === "issuer-confirmed"
        ? Check
        : level === "stale"
          ? CircleAlert
          : CircleDashed;

  return (
    <span className={`evidence-badge evidence-${tone}`}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}
