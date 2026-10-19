import { ArtDroplet, ArtFlask, ArtMolecule } from "@/components/vial-art";
import type { ResearchSubject } from "@/lib/research-explorer";
import { researchThemeById } from "@/lib/research-explorer";

/**
 * Returns the original VialGrade market's playful flat scientific artwork
 * without using vendor photos, vials, labeled product packaging, or implied
 * chemical structures. These are intentionally decorative theme graphics.
 */
export function ResearchSubjectArt({
  subject,
  compact = false,
  hero = false,
}: {
  subject: ResearchSubject;
  compact?: boolean;
  hero?: boolean;
}) {
  const theme = researchThemeById(subject.theme);
  const index = subject.slug.length % 3;
  return (
    <div
      aria-hidden="true"
      className={"relative isolate overflow-hidden border-b-2 border-[#161919]/90 " + (hero ? "h-44 lg:h-full lg:min-h-[275px]" : compact ? "h-32" : "h-40")}
      style={{ backgroundColor: theme.tint }}
    >
      <span
        className="absolute -right-10 -top-20 size-52 rounded-full border-2 border-[#161919]/10"
        aria-hidden="true"
      />
      <span
        className="absolute -bottom-28 -left-11 size-52 rounded-full border-2 border-[#161919]/10"
        aria-hidden="true"
      />
      <span
        className="absolute left-5 top-4 inline-flex rounded-full border border-[#161919]/10 bg-white/85 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.1em]"
        style={{ color: theme.color }}
      >
        {theme.short}
      </span>
      <div className={"absolute bottom-0 right-4 flex items-end " + (index === 0 ? "rotate-[-9deg]" : index === 1 ? "rotate-[7deg]" : "")}>
        {subject.theme === "host-defense" ? (
          <ArtFlask className={compact ? "w-20 drop-shadow-[4px_4px_0_#1a1c1a]" : "w-24 drop-shadow-[5px_5px_0_#1a1c1a]"} fill="#12b3a6" />
        ) : subject.theme === "neuropeptides" ? (
          <ArtDroplet className={compact ? "w-[82px] drop-shadow-[4px_4px_0_#1a1c1a]" : "w-[104px] drop-shadow-[5px_5px_0_#1a1c1a]"} fill="#ea9c58" />
        ) : (
          <ArtMolecule
            className={compact ? "w-24 drop-shadow-[4px_4px_0_#1a1c1a]" : "w-32 drop-shadow-[5px_5px_0_#1a1c1a]"}
            a={theme.color}
            b={subject.theme === "metabolic" ? "#12b3a6" : "#7da8f0"}
            c="#fff"
          />
        )}
      </div>
      <span className="absolute bottom-4 left-5 text-[11px] font-bold uppercase tracking-[.1em] text-[#161919]/45">
        Scientific index
      </span>
    </div>
  );
}
