import type { Metadata } from "next";
import Link from "next/link";
import { unsubscribeAction } from "../actions";

export const metadata: Metadata = { title: "Unsubscribe | VialGrade", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ id?: string; t?: string; result?: string }> }) {
  const { id, t, result } = await searchParams;
  return (
    <div className="mx-auto max-w-[640px] px-5 py-20 sm:px-8">
      <h1 className="text-balance text-4xl font-extrabold tracking-[-.04em]">Unsubscribe</h1>
      {result === "ok" ? (
        <p role="status" className="mt-5 text-base font-medium leading-7">Done. Your email address and consent record were deleted and no more updates will be sent.</p>
      ) : result === "invalid" ? (
        <p role="status" className="mt-5 text-base font-medium leading-7">This link is not valid. Email the address in the <Link href="/legal/privacy" className="font-bold text-[#2b31d8] underline underline-offset-4">privacy notice</Link> and a person will delete your address.</p>
      ) : id && t ? (
        <form action={unsubscribeAction} className="mt-5">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="t" value={t} />
          <p className="text-base font-medium leading-7">Press the button to stop the monthly update and delete your email address from our list.</p>
          <button type="submit" className="ink hard-sm press mt-5 inline-flex min-h-11 items-center rounded-full bg-white px-6 text-sm font-extrabold">Unsubscribe and delete my address</button>
        </form>
      ) : (
        <p className="mt-5 text-base font-medium leading-7">Use the unsubscribe link in any update email. If you cannot, see the <Link href="/legal/privacy" className="font-bold text-[#2b31d8] underline underline-offset-4">privacy notice</Link> to ask for deletion.</p>
      )}
    </div>
  );
}
