"use client";

import { useActionState } from "react";
import Link from "next/link";
import { subscribeAction, type SubscribeState } from "@/app/intelligence/updates/actions";

const MESSAGE: Record<SubscribeState["status"], string> = {
  idle: "",
  sent: "Check your inbox for a confirmation link. Nothing is sent until you confirm. If you do not see it in a few minutes, look in spam.",
  invalid: "That does not look like an email address. Please check it and try again.",
  unavailable: "We could not send a confirmation email just now, so nothing was saved. Please try again later.",
  "needs-consent": "Please tick the box so we know you agree.",
  "slow-down": "Too many attempts from this connection. Please try again in an hour.",
};

export function UpdatesSignupForm() {
  const [state, action, pending] = useActionState(subscribeAction, { status: "idle" } as SubscribeState);
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <div>
        <label htmlFor="digest-email" className="block text-sm font-bold">Email address</label>
        <input id="digest-email" name="email" type="email" autoComplete="email" required maxLength={254}
          className="mt-2 min-h-11 w-full max-w-md rounded-xl border-2 border-[#111214] bg-white px-4 text-sm" />
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="digest-company">Company</label>
        <input id="digest-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex items-start gap-3">
        <input id="digest-consent" name="consent" type="checkbox" value="yes" className="mt-1 size-5 shrink-0" />
        <label htmlFor="digest-consent" className="text-sm leading-6">
          I agree VialGrade may store this email to send the weekly update. See the{" "}
          <Link href="/legal/privacy" className="font-bold text-[#2b31d8] underline underline-offset-4">privacy notice</Link>.
          I can unsubscribe or ask for deletion any time.
        </label>
      </div>
      <button type="submit" disabled={pending}
        className="ink hard-sm press inline-flex min-h-11 items-center rounded-full bg-white px-6 text-sm font-extrabold disabled:opacity-60">
        {pending ? "Sending…" : "Email me"}
      </button>
      <p role="status" aria-live="polite" className="min-h-6 text-sm font-medium text-[#3a3d46]">{MESSAGE[state.status]}</p>
    </form>
  );
}
