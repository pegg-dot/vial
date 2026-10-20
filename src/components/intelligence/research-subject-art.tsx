import type { ResearchSubject } from "@/lib/research-explorer";
import { researchThemeById } from "@/lib/research-explorer";
import { VialPlain } from "@/components/vial-art";

// Reuses the original marketplace's sticker-vial visual *as a decorative brand
// motif*, not as an image of a tested or purchasable research material.
const COLORS = ["#2b31d8", "#12b3a6", "#6d5dfc", "#e0872b", "#d8467f", "#2b8fe0"];
function indexFor(slug: string) {
  return [...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0) % COLORS.length;
}
export function ResearchSubjectArt({ subject, compact = false, hero = false }: {
  subject: ResearchSubject;
  compact?: boolean;
  hero?: boolean;
}) {
  const theme = researchThemeById(subject.theme);
  return (
    <div aria-hidden="true"
      className={"relative flex min-w-0 flex-col overflow-hidden border-b-2 border-[#111214] px-4 py-3 " +
        (hero ? "min-h-[190px] sm:min-h-[240px] sm:px-6" : compact ? "h-[126px]" : "h-[165px]")}
      style={{ backgroundColor: theme.tint }}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="ink-1 truncate rounded-full bg-white px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.1em] text-[#16191b]">
          {theme.short}
        </span>
        <span className="rounded border border-[#111214]/20 bg-white/75 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#50555e]">Identity reference</span>
      </div>
      <div className="flex flex-1 items-center justify-between gap-4">
        <p className="max-w-[60%] text-[14px] font-extrabold leading-tight tracking-[-.02em] text-[#111214] sm:text-base">
          {subject.name}
        </p>
        <VialPlain className={"shrink-0 drop-shadow-[3px_3px_0_#111214] " +
          (hero ? "h-[124px] w-[82px] sm:h-[145px] sm:w-[96px]" : "h-[78px] w-[55px]")}
          liquid={COLORS[indexFor(subject.slug)]} />
      </div>
      <div className="mt-auto flex justify-between gap-2 text-[9px] font-bold uppercase tracking-[.1em] text-[#4f5962]">
        <span className="truncate">{subject.referenceLabel.match(/CID \d+/)?.[0] || subject.referenceLabel.match(/SID \d+/)?.[0] || "Public source"}</span>
        <span>Not a product</span>
      </div>
    </div>
  );
}
