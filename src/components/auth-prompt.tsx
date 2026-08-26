"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellPlus, Check, Loader2, ShieldCheck, X } from "lucide-react";

// The one place the app asks a visitor to make an account.
//
// Before this existed there were three separate behaviours and none of them asked: Follow and
// Save-search hard-redirected to /login and dropped the user's intent on the floor, and a guest
// watchlist save silently went to localStorage with no mention that it would not survive the
// device. A person who clicked "Follow changes", signed in, and landed back on the page was NOT
// following — the button had reset and nothing said so.
//
// So this prompt does the whole job in place: it takes the account details, calls the same APIs the
// dedicated pages call (both of which already set the session cookie), refreshes the server
// components, and then runs whatever the visitor was originally trying to do.

export const AUTH_PROMPT_DISMISSED_KEY = "vial-auth-prompt-dismissed-v1";

// The dismissal lives in localStorage, which is an external store — so it is read through
// useSyncExternalStore rather than copied into state by an effect. That also makes it correct
// across tabs: saying "not now" in one tab stops the prompt in the others too.
const listeners = new Set<() => void>();

export function subscribeAuthPromptDismissed(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => { listeners.delete(callback); window.removeEventListener("storage", callback); };
}

export function readAuthPromptDismissed() {
  try { return window.localStorage.getItem(AUTH_PROMPT_DISMISSED_KEY) === "1"; } catch { return false; }
}

/** Server snapshot. Treated as dismissed so the dialog can never be in the server-rendered HTML. */
export function readAuthPromptDismissedOnServer() { return true; }

export function markAuthPromptDismissed() {
  try { window.localStorage.setItem(AUTH_PROMPT_DISMISSED_KEY, "1"); } catch { /* private mode: it simply asks again next visit */ }
  for (const listener of listeners) listener();
}

/** Ten seconds, per the brief: long enough to have read something, short enough to still be here. */
export const AUTH_PROMPT_DELAY_MS = 10_000;

// Routes where an account prompt is noise or actively in the way: the visitor is already doing the
// thing, or is not a consumer at all.
const SUPPRESSED = ["/login", "/register", "/admin", "/seller", "/lab", "/checkout", "/cart", "/offline"];

export function shouldAutoPrompt({ pathname, authenticated, dismissed }: { pathname: string; authenticated: boolean; dismissed: boolean }) {
  if (authenticated || dismissed) return false;
  return !SUPPRESSED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export interface AuthPromptRequest {
  /** What the visitor was trying to do — shown so the ask never feels arbitrary. */
  reason?: string;
  /** Run after the session cookie is set and the server components have been refreshed. */
  onAuthenticated?: () => void | Promise<void>;
}

export function AuthPromptOverlay({ request, onClose }: { request: AuthPromptRequest; onClose: (dismissedForever: boolean) => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  // Take focus into the dialog and hand it back on close — a modal that strands the keyboard on the
  // page behind it is worse than no modal.
  useEffect(() => {
    openerRef.current = document.activeElement;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(true); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [onClose]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const body = mode === "register"
      ? { displayName: String(form.get("displayName") ?? ""), email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") }
      : { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") };
    try {
      const response = await fetch(mode === "register" ? "/api/v1/auth/register" : "/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? (mode === "register" ? "Could not create your account." : "Those details did not match an account."));
        setPending(false);
        return;
      }
      // The cookie is set by the response above. Refresh so every server component on the page
      // re-renders authenticated, THEN finish what the visitor came to do.
      router.refresh();
      await request.onAuthenticated?.();
      setDone(true);
      setPending(false);
      window.setTimeout(() => onClose(true), 1400);
    } catch {
      setError("Something went wrong. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/45 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0" role="presentation" onMouseDown={() => onClose(true)}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-prompt-title"
        className="ink hard-lg w-full max-w-[440px] rounded-[22px] bg-white p-6 outline-none sm:p-8"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="ink grid size-11 shrink-0 place-items-center rounded-[13px] bg-[#2b31d8] text-white">
            {done ? <Check className="size-5" /> : <BellPlus className="size-5" />}
          </span>
          <button onClick={() => onClose(true)} aria-label="Close" className="ink-1 rounded-full bg-white p-2 text-[var(--muted)] transition hover:text-[#111214]">
            <X className="size-4" />
          </button>
        </div>

        {done ? (
          <>
            <h2 id="auth-prompt-title" className="mt-5 text-2xl font-extrabold tracking-[-.035em]">You&rsquo;re in.</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">
              {request.reason ? `Done — ${request.reason.toLowerCase()}` : "Your saves now follow you across devices."} It will show up in <span className="font-bold text-[#111214]">For you</span>.
            </p>
          </>
        ) : (
          <>
            <h2 id="auth-prompt-title" className="mt-5 text-2xl font-extrabold leading-[1.1] tracking-[-.035em]">
              {request.reason ?? "Keep track of what changes."}
            </h2>
            <p className="mt-2.5 text-sm font-medium leading-6 text-[var(--muted)]">
              A free account remembers the vendors and compounds you follow, and tells you when a price moves or a
              lab test changes. VialGrade never sells anything and never takes payment.
            </p>

            {error && <p className="ink-1 mt-4 rounded-[10px] bg-[#fff1f0] px-3.5 py-2.5 text-sm font-semibold text-[#d3372c]">{error}</p>}

            <form onSubmit={submit} className="mt-5 space-y-3">
              {mode === "register" && (
                <label className="block text-xs font-bold uppercase tracking-[.1em] text-[var(--muted)]">Name
                  <input name="displayName" type="text" required autoComplete="name" className="field mt-1.5" />
                </label>
              )}
              <label className="block text-xs font-bold uppercase tracking-[.1em] text-[var(--muted)]">Email
                <input name="email" type="email" required autoComplete="email" className="field mt-1.5" />
              </label>
              <label className="block text-xs font-bold uppercase tracking-[.1em] text-[var(--muted)]">Password
                <input name="password" type="password" required minLength={mode === "register" ? 12 : 1} autoComplete={mode === "register" ? "new-password" : "current-password"} className="field mt-1.5" />
                {mode === "register" && <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-[var(--muted)]">At least 12 characters.</span>}
              </label>
              <button disabled={pending} className="ink hard-sm press-blue flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2b31d8] text-sm font-bold text-white disabled:opacity-60">
                {pending && <Loader2 className="size-4 animate-spin" />}
                {pending ? "One moment…" : mode === "register" ? "Create free account" : "Sign in"}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(null); }} className="text-xs font-bold text-[#2b31d8] underline underline-offset-4">
                {mode === "register" ? "I already have an account" : "Create an account instead"}
              </button>
              <button onClick={() => onClose(true)} className="text-xs font-bold text-[var(--muted)] hover:text-[#111214]">Not now</button>
            </div>

            <p className="mt-5 flex items-start gap-2 border-t-2 border-[#111214] pt-4 text-[11px] font-medium leading-5 text-[var(--muted)]">
              <ShieldCheck className="mt-px size-3.5 shrink-0" />
              We ask once. Close this and the account button stays in the top right whenever you want it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
