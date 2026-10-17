import Link from "next/link";
import { requirePrincipal } from "@/server/auth/principal";
import { logoutAction } from "@/server/auth/actions";
export default async function Page() {
  const principal = await requirePrincipal({ accountTypes: ["customer", "seller"] });
  return (
    <section className="mx-auto max-w-[900px] px-5 py-16 sm:px-8">
      <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#2b31d8]">Existing account</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-.05em]">Account access during privacy review</h1>
      <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
        Signed in as {principal.email}. New research preferences, compound follows,
        saved searches, comparisons and personal alerts are paused. Existing users
        can still manage account security and request access, correction or deletion
        of retained information through the privacy contact process.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/account/security" className="ink hard-sm press rounded-full bg-[#111214] px-5 py-3 text-sm font-bold text-white">Account security</Link>
        <Link href="/legal/privacy" className="ink hard-sm press rounded-full bg-white px-5 py-3 text-sm font-bold">Privacy and data requests</Link>
        <Link href="/intelligence" className="ink hard-sm press rounded-full bg-white px-5 py-3 text-sm font-bold">Public research</Link>
      </div>
      <form action={logoutAction} className="mt-8"><button className="text-sm font-bold text-[#2b31d8] underline underline-offset-2">Sign out</button></form>
    </section>
  );
}
