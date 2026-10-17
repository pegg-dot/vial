import type { Metadata } from "next";
import Link from "next/link";
import { BookmarkX } from "lucide-react";

export const metadata: Metadata = {
  title: "Personalized research paused",
  description: "Personalized research, saved-search alerts and recommendations are unavailable during a privacy review.",
  robots: { index: false, follow: false },
};
export default function ForYouPage() {
  // No personalized synthesis, source reads or notification writes on page view.
  // Existing users retain account access and can request data corrections/deletion.
  return (
    <section className="mx-auto max-w-[800px] px-5 py-20 sm:px-8">
      <BookmarkX className="size-8 text-[#2b31d8]" />
      <h1 className="mt-6 text-4xl font-extrabold tracking-[-.05em] sm:text-5xl">Personalized research is paused.</h1>
      <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)]">
        We are not generating personal compound feeds, research alerts or recommendations
        while we assess sensitive-data collection, data rights and retention.
        Public research pages are still available without an account.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/intelligence" className="ink hard-sm press rounded-full bg-[#111214] px-5 py-3 text-sm font-bold text-white">Browse research intelligence</Link>
        <Link href="/legal/privacy" className="ink hard-sm press rounded-full bg-white px-5 py-3 text-sm font-bold">Your privacy and data requests</Link>
      </div>
    </section>
  );
}
