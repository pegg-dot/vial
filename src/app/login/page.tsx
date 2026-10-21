import type { Metadata } from "next";
import { PasswordField } from "@/components/password-field";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { redirect } from "next/navigation";
import { loginAction } from "@/server/auth/actions";
import { getCurrentPrincipal } from "@/server/auth/principal";
export const metadata: Metadata = { title: "Sign in", description: "Sign in to your VialGrade account." };
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const p = await searchParams;
  // Already signed in: show the account, not the form. `next` is ignored on purpose: a customer sent
  // here from /seller or /lab would otherwise bounce between the perimeter and this page forever.
  const principal = await getCurrentPrincipal();
  if (principal) redirect(principal.accountType === "staff" ? "/admin" : "/account");
  return (
    <section className="mx-auto max-w-[520px] px-5 py-20 sm:px-8">
      <div className="ink hard-lg rounded-[24px] bg-white p-8">
        <span className="ink inline-grid size-12 place-items-center rounded-[14px] bg-[#2b31d8] text-white"><LogIn className="size-6" /></span>
        <h1 className="mt-6 text-4xl font-extrabold tracking-[-.04em] text-[#111214]">Continue to VialGrade.</h1>
        {p.error && <p className="ink-1 mt-4 rounded-[10px] bg-[#fff1f0] px-3 py-2 text-sm font-semibold text-[#d3372c]">{p.error}</p>}
        <form action={loginAction} className="mt-8 space-y-4">
          <input type="hidden" name="returnTo" value={p.next || "/account"} />
          <label className="block text-sm font-bold text-[#111214]">Email<input name="email" type="email" required className="field mt-2" /></label>
          <PasswordField name="password" required autoComplete="current-password" />
          <button className="ink hard-sm press-blue h-12 w-full rounded-full bg-[#2b31d8] text-sm font-bold text-white">Sign in</button>
        </form>
        <p className="mt-6 text-sm font-medium leading-7 text-[var(--muted)]">New registrations are paused during the privacy review. You can <Link href="/intelligence" className="font-bold text-[#2b31d8] underline underline-offset-4">use public research without an account</Link>, or <Link href="/register" className="font-bold text-[#2b31d8] underline underline-offset-4">read the registration notice</Link>.</p>
        {process.env.NODE_ENV !== "production" && <p className="mt-6 text-xs font-medium text-[var(--muted)]">Demo: nora@example.test / VialGradeDemoCustomer!2026</p>}
      </div>
    </section>
  );
}
