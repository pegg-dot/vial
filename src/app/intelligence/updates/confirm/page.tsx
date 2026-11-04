import type { Metadata } from "next";
import Link from "next/link";
import { confirmAction } from "../actions";

export const metadata: Metadata = { title: "Confirm your email | VialGrade", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ id?: string; t?: string; result?: string }> }) {
  const { id, t, result } = await searchParams;
  return (
    <div className="mx-auto max-w-[640px] px-5 py-20 sm:px-8">
      <h1 className="text-balance text-4xl font-extrabold tracking-[-.04em]">Confirm your email</h1>
      {result === "ok" ? (
        <p role="status" className="mt-5 text-base font-medium leading-7">You are on the list. The next monthly update arrives only if a record we track has changed. Every email has an unsubscribe link.</p>
      ) : result === "invalid" ? (
        <p role="status" className="mt-5 text-base font-medium leading-7">This confirmation link is not valid or has expired (requests expire after 3 days). Nothing was saved. You can <Link href="/intelligence/updates" className="font-bold text-[#2b31d8] underline underline-offset-4">start again</Link>.</p>
      ) : id && t ? (
        <form action={confirmAction} className="mt-5">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="t" value={t} />
          <p className="text-base font-medium leading-7">Press the button to confirm you want the monthly update email.</p>
          <button type="submit" className="ink hard-sm press mt-5 inline-flex min-h-11 items-center rounded-full bg-white px-6 text-sm font-extrabold">Confirm my email address</button>
        </form>
      ) : (
        <p className="mt-5 text-base font-medium leading-7">Open the confirmation link from your email. Or <Link href="/intelligence/updates" className="font-bold text-[#2b31d8] underline underline-offset-4">request a new one</Link>.</p>
      )}
    </div>
  );
}
