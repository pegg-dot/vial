"use client";
import Link from "next/link";
import { ArrowUpRight, Bookmark, Check } from "lucide-react";
import { useMarketplace } from "./marketplace-state";

// Save a stack the way a listing is saved: a bookmark that works for a guest (localStorage) and
// syncs for an account, landing in /watchlist beside the saved listings. `icon` is the card's
// corner button — it stops the click before the card's own link sees it; `full` is the labelled
// pill on the stack page, which also says where the save went.
export function SaveStackButton({ slug, name, variant = "icon", className = "" }: { slug: string; name: string; variant?: "icon" | "full"; className?: string }) {
  const { isStackSaved, toggleStackSave } = useMarketplace();
  const saved = isStackSaved(slug);
  const onClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    toggleStackSave(slug);
  };
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
        className={`ink-1 grid size-8 shrink-0 place-items-center rounded-full transition ${saved ? "bg-[#111214] text-white" : "bg-white text-[#111214] hover:bg-[var(--background)]"} ${className}`}
      >
        <Bookmark className={`size-3.5 ${saved ? "fill-current" : ""}`} />
      </button>
    );
  }
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        className={`ink hard-sm press inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition ${saved ? "bg-[#111214] text-white" : "bg-white text-[#111214]"}`}
      >
        {saved ? <Check className="size-4" /> : <Bookmark className="size-4" />}
        {saved ? "Saved" : "Save stack"}
      </button>
      <p className="mt-2 text-xs font-medium text-[var(--muted)]">
        {saved ? (
          <>It&rsquo;s in <Link href="/watchlist" className="inline-flex items-center gap-0.5 font-bold text-[#2b31d8] underline underline-offset-2">Saved<ArrowUpRight className="size-3" /></Link> with your listings.</>
        ) : (
          <>Keeps this stack in Saved, next to your listings.</>
        )}
      </p>
    </div>
  );
}
