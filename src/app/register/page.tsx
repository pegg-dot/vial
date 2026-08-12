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
    <section className="mx-auto max-w-[520px] px-5 py-20 sm:px-8">
      <div className="ink hard-lg rounded-[24px] bg-white p-8">
        <span className="ink inline-grid size-12 place-items-center rounded-[14px] bg-[#2b31d8] text-white"><UserPlus className="size-6" /></span>
        <h1 className="mt-6 text-4xl font-extrabold tracking-[-.04em] text-[#111214]">Create your VialGrade account.</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">Free. Save vendors and compounds, and get alerted when a price or lab test changes. VialGrade never sells anything.</p>
        {error && <p className="ink-1 mt-4 rounded-[10px] bg-[#fff1f0] px-4 py-3 text-sm font-semibold text-[#d3372c]">{error}</p>}
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm font-bold text-[#111214]">Name<input name="displayName" type="text" required autoComplete="name" className="field mt-2" /></label>
          <label className="block text-sm font-bold text-[#111214]">Email<input name="email" type="email" required autoComplete="email" className="field mt-2" /></label>
          <label className="block text-sm font-bold text-[#111214]">Password<input name="password" type="password" required minLength={12} autoComplete="new-password" className="field mt-2" /><span className="mt-1 block text-xs font-medium text-[var(--muted)]">At least 12 characters.</span></label>
          <button disabled={pending} className="ink hard-sm press-blue h-12 w-full rounded-full bg-[#2b31d8] text-sm font-bold text-white disabled:opacity-60">{pending ? "Creating account…" : "Create account"}</button>
        </form>
        <p className="mt-6 text-sm font-medium text-[var(--muted)]">Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-bold text-[#2b31d8] underline underline-offset-4">Sign in</Link></p>
      </div>
    </section>
  );
}
