"use client";

import { BellPlus, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useMarketplace } from "./marketplace-state";

type FollowEntity = "compound" | "vendor" | "listing";

// "Follow changes" used to send a signed-out visitor to /login?next=<path> and drop the follow.
// They came back to the same page with the button reset to "Follow changes" and nothing telling
// them the thing they asked for had not happened. Now the ask happens in place and the follow is
// completed on the other side of it — the intent is carried, not discarded.
export function FollowButton({ entityType, entitySlug, entityName, initialFollowed, tone = "light" }: {
  entityType: FollowEntity;
  entitySlug: string;
  /** Used in the sign-in ask so it names what the visitor actually clicked. */
  entityName?: string;
  initialFollowed: boolean;
  /** "dark" when the button sits on a near-black panel (the vendor header), where --muted is unreadable. */
  tone?: "light" | "dark";
}) {
  const { authenticated, promptSignIn } = useMarketplace();
  const [followed, setFollowed] = useState(initialFollowed);
  const [busy, setBusy] = useState(false);
  const [justFollowed, setJustFollowed] = useState(false);
  const [failed, setFailed] = useState(false);

  const label = entityName ?? entitySlug.replace(/-/g, " ");
  const helper = tone === "dark" ? "text-white/65" : "text-[var(--muted)]";
  const helperLink = tone === "dark" ? "text-[#8fa2ff]" : "text-[#2b31d8]";
  const helperBad = tone === "dark" ? "text-[#ff9d95]" : "text-[#d3372c]";

  const write = useCallback(async (next: boolean) => {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/v1/follows", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entityType, entitySlug, followed: next }),
      });
      // A failed write used to leave the button silently unchanged, which reads as "nothing
      // happened" when the truth is "we lost it". Say so.
      if (!response.ok) { setFailed(true); return; }
      setFollowed(next);
      setJustFollowed(next);
      void fetch("/api/v1/decision-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType: next ? "followed" : "unfollowed", subjectType: entityType, subjectId: entitySlug }),
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [entitySlug, entityType]);

  function onClick() {
    if (!authenticated) {
      promptSignIn({
        reason: `Follow ${label} for changes.`,
        onAuthenticated: () => write(true),
      });
      return;
    }
    void write(!followed);
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={followed}
        className={`ink-1 hard-sm press inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition ${followed && tone !== "dark" ? "bg-[#111214] text-white" : followed ? "bg-[#2b31d8] text-white" : "bg-white text-[#111214]"}`}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : followed ? <Check className="size-4" /> : <BellPlus className="size-4" />}
        {busy ? "Saving…" : followed ? "Following" : "Follow changes"}
      </button>

      {/* Where it went. A toggle that flips and says nothing leaves the person guessing whether
          following did anything at all — which is exactly what it did before. */}
      {justFollowed && followed && (
        <p className={`mt-2.5 flex flex-wrap items-center gap-1 text-xs font-medium ${helper}`}>
          Price and evidence changes now reach you in
          <Link href="/for-you" className={`inline-flex items-center gap-0.5 font-bold underline underline-offset-2 ${helperLink}`}>For you<ArrowUpRight className="size-3" /></Link>
          and
          <Link href="/account/notifications" className={`inline-flex items-center gap-0.5 font-bold underline underline-offset-2 ${helperLink}`}>your alerts<ArrowUpRight className="size-3" /></Link>.
        </p>
      )}
      {!followed && !busy && !justFollowed && (
        <p className={`mt-2.5 text-xs font-medium ${helper}`}>Get told when a price moves or a lab test changes.</p>
      )}
      {failed && (
        <p className={`mt-2.5 text-xs font-bold ${helperBad}`}>We couldn&rsquo;t save that. Try again in a moment.</p>
      )}
    </div>
  );
}
