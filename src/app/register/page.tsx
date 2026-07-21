"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const params = useSearchParams();
  const next = params.get("next") || "/for-you";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      displayName: String(form.get("displayName") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not create your account.");
        setPending(false);
        return;
      }
      // Full navigation so the app reloads authenticated — the marketplace provider
      // then merges any guest watchlist saved before signing up.
      window.location.assign(next);
    } catch {
      setError("Something went wrong. Please try again.");
      setPending(false);
    }
  }

  return (
    <section className="mx-auto max-w-[560px] px-5 py-20 sm:px-8">
      <div className="rounded-[32px] border border-black/[.08] bg-white p-8">
        <UserPlus />
        <h1 className="mt-6 text-4xl font-semibold tracking-[-.04em]">Create your VIAL account.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Free. Save vendors and compounds, and get alerted when a price or lab test changes. VIAL never sells anything.</p>
        {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm font-medium">Name<input name="displayName" type="text" required autoComplete="name" className="field mt-2" /></label>
          <label className="block text-sm font-medium">Email<input name="email" type="email" required autoComplete="email" className="field mt-2" /></label>
          <label className="block text-sm font-medium">Password<input name="password" type="password" required minLength={12} autoComplete="new-password" className="field mt-2" /><span className="mt-1 block text-xs text-[var(--muted)]">At least 12 characters.</span></label>
          <button disabled={pending} className="h-12 w-full rounded-full bg-black text-sm font-semibold text-white transition hover:bg-black/85 disabled:opacity-60">{pending ? "Creating account…" : "Create account"}</button>
        </form>
        <p className="mt-6 text-sm text-[var(--muted)]">Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-black underline underline-offset-4">Sign in</Link></p>
      </div>
    </section>
  );
}
