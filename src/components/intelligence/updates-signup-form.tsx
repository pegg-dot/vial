"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { SUBSCRIBE_MESSAGE, UPDATES_SUBSCRIBE_PATH, parseSubscribeReply, signupSucceeded, type SubscribeStatus } from "@/lib/updates-signup";

async function submitSignup(data: FormData): Promise<SubscribeStatus> {
  try {
    const response = await fetch(UPDATES_SUBSCRIBE_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), consent: data.get("consent"), company: data.get("company") }),
    });
    return parseSubscribeReply(await response.json().catch(() => null));
  } catch {
    return "unavailable";
  }
}

/**
 * The email form: an address and a consent box the reader must tick. `compact` is the first-visit
 * prompt's version (tighter, no top margin); `idPrefix` keeps field ids unique if both ever render.
 * Submitted by hand rather than through a form `action`, because React resets an action form
 * afterwards and would erase the reader's address and ticked box after every error.
 */
export function UpdatesSignupForm({ compact = false, idPrefix = "digest", onDone }: {
  compact?: boolean; idPrefix?: string; onDone?: (status: SubscribeStatus) => void;
}) {
  const [status, setStatus] = useState<SubscribeStatus>("idle");
  const [pending, startTransition] = useTransition();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const next = await submitSignup(data);
      setStatus(next);
      if (signupSucceeded(next)) onDone?.(next);
    });
  };
  const done = signupSucceeded(status);
  return (
    <form onSubmit={onSubmit} className={compact ? "space-y-3" : "mt-6 space-y-4"} noValidate>
      {!(compact && done) && (
        <>
          <div>
            <label htmlFor={idPrefix + "-email"} className={"block font-bold " + (compact ? "text-xs" : "text-sm")}>Email address</label>
            <input id={idPrefix + "-email"} name="email" type="email" autoComplete="email" required maxLength={254}
              className={"min-h-11 w-full rounded-xl border-2 border-[#111214] bg-white px-4 text-sm " + (compact ? "mt-1.5" : "mt-2 max-w-md")} />
          </div>
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor={idPrefix + "-company"}>Company</label>
            <input id={idPrefix + "-company"} name="company" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          <div className="flex items-start gap-3">
            <input id={idPrefix + "-consent"} name="consent" type="checkbox" value="yes" className="mt-1 size-5 shrink-0" />
            <label htmlFor={idPrefix + "-consent"} className={compact ? "text-xs leading-5" : "text-sm leading-6"}>
              I agree VialGrade may store this email to send the monthly update. See the{" "}
              <Link href="/legal/privacy" className="font-bold text-[#2b31d8] underline underline-offset-4">privacy notice</Link>.
              I can unsubscribe or ask for deletion any time.
            </label>
          </div>
          <button type="submit" disabled={pending}
            className={"ink hard-sm press inline-flex min-h-11 items-center rounded-full px-6 text-sm font-extrabold disabled:opacity-60 " + (compact ? "bg-[#2b31d8] text-white" : "bg-white")}>
            {pending ? "Sending…" : "Email me"}
          </button>
        </>
      )}
      <p role="status" aria-live="polite" className={"font-medium text-[#3a3d46] " + (compact ? "text-xs leading-5" : "min-h-6 text-sm")}>{SUBSCRIBE_MESSAGE[status]}</p>
    </form>
  );
}
