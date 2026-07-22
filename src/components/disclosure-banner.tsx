import { FlaskConical } from "lucide-react";

export function DisclosureBanner() {
  return (
    <div className="border-b border-black/[.06] bg-white/55">
      <div className="mx-auto flex min-h-9 max-w-[1320px] items-center justify-center gap-2 px-5 py-2 text-center text-[11px] font-medium text-[var(--muted)] sm:px-8">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden="true" />
        <span>Records are demo unless marked <strong className="font-semibold text-emerald-700">Live</strong> — Live data is aggregated from real public sources. VIAL never sells; it links out to the vendor.</span>
      </div>
    </div>
  );
}
