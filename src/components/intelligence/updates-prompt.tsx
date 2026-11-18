"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Mail, X } from "lucide-react";
import { UPDATES_PROMPT_DELAY_MS, UPDATES_PROMPT_KEY, updatesPromptAllowedOn, updatesPromptSeen } from "@/lib/updates-prompt";
import { UpdatesSignupForm } from "./updates-signup-form";

function seen(): boolean {
  // A browser that refuses storage cannot remember, so it is treated as having seen the prompt:
  // showing it on every page would be worse than never showing it.
  try { return updatesPromptSeen(window.localStorage.getItem(UPDATES_PROMPT_KEY)); } catch { return true; }
}
function markSeen(): boolean {
  try { window.localStorage.setItem(UPDATES_PROMPT_KEY, "seen"); return true; } catch { return false; }
}

/**
 * The email signup, offered once: a card that opens shortly after a signed-out reader's first page
 * and never again in that browser, whether they sign up, close it or ignore it. It does not block
 * the page (no backdrop, no focus trap); the form is inside it, so signing up is one step. The
 * same form lives at /intelligence/updates for anyone who closed the card.
 */
export function UpdatesPrompt() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const allowed = updatesPromptAllowedOn(pathname);

  useEffect(() => {
    if (!allowed || open || seen()) return;
    const timer = window.setTimeout(() => {
      // Marked as it opens, so a second tab or the next page cannot open another.
      if (!seen() && markSeen()) setOpen(true);
    }, UPDATES_PROMPT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [allowed, open, pathname]);

  if (!open) return null;
  return (
    <aside role="dialog" aria-label="Monthly update email" data-testid="updates-prompt"
      className="ink hard fixed inset-x-3 bottom-3 z-40 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[18px] bg-white p-5 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[400px]">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#2b31d8]"><Mail className="size-4" aria-hidden="true" /> Monthly update</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-[#4a4d56] hover:bg-[#f2f2ef] hover:text-[#111214]">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-1 text-lg font-extrabold leading-6 tracking-[-.02em]">{done ? "Thank you." : "Get a note when a source record changes."}</p>
      {!done && <p className="mt-1.5 text-[13px] font-medium leading-5 text-[#4a4d56]">One email a month, only if something changed. Email only: no account, no compound interests saved.</p>}
      <div className="mt-3">
        <UpdatesSignupForm compact idPrefix="prompt" onDone={() => setDone(true)} />
      </div>
      <button type="button" onClick={() => setOpen(false)} className="mt-1 inline-flex min-h-11 items-center text-sm font-bold text-[var(--muted)] underline underline-offset-4">{done ? "Close" : "Not now"}</button>
    </aside>
  );
}
