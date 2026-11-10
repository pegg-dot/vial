"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UPDATES_PROMPT_DELAY_MS, UPDATES_PROMPT_KEY, UPDATES_PROMPT_SCROLL_PX, updatesPromptAllowedOn } from "@/lib/updates-prompt";

function remembered(): boolean {
  try { return window.localStorage.getItem(UPDATES_PROMPT_KEY) === "dismissed"; } catch { return false; }
}
function remember() {
  try { window.localStorage.setItem(UPDATES_PROMPT_KEY, "dismissed"); } catch { /* the bar simply returns next visit */ }
}

/**
 * A slim, non-blocking bar for signed-out readers: after about 10 seconds or the first real scroll,
 * whichever is first. Dismissal is remembered in this browser only; the bar is never required and
 * collects nothing itself. The email form lives on its own page with the consent text.
 */
export function UpdatesPrompt() {
  const pathname = usePathname();
  const [shown, setShown] = useState(false);
  const allowed = updatesPromptAllowedOn(pathname);

  useEffect(() => {
    if (!allowed || remembered()) return;
    const show = () => setShown(true);
    const timer = window.setTimeout(show, UPDATES_PROMPT_DELAY_MS);
    const onScroll = () => { if (window.scrollY > UPDATES_PROMPT_SCROLL_PX) show(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.clearTimeout(timer); window.removeEventListener("scroll", onScroll); };
  }, [allowed, pathname]);

  if (!allowed || !shown) return null;
  const dismiss = () => { remember(); setShown(false); };
  return (
    <aside aria-label="Monthly update email" className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-[#111214] bg-white px-4 py-3 sm:px-8">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="max-w-3xl text-sm font-medium leading-6">
          <strong className="font-extrabold">Get a monthly note when a source record changes.</strong>{" "}
          Email only, no account, no compound interests saved. Unsubscribe any time.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/intelligence/updates" onClick={remember} className="ink hard-sm press inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-extrabold">Email me</Link>
          <button type="button" onClick={dismiss} className="inline-flex min-h-11 items-center px-3 text-sm font-bold text-[var(--muted)] underline underline-offset-4">Not now</button>
        </div>
      </div>
    </aside>
  );
}
