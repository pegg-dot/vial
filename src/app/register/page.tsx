import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";

export const metadata: Metadata = {
  title: "New account registration paused",
  robots: { index: false, follow: true },
};

export default function RegisterPage() {
  return (
    <section className="mx-auto max-w-[600px] px-5 py-20 sm:px-8">
      <div className="ink hard-lg rounded-[22px] bg-white p-8 sm:p-10">
        <UserPlus className="size-7 text-[#2b31d8]" />
        <h1 className="mt-6 text-3xl font-extrabold tracking-[-.04em]">New account registration is paused.</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
          VialGrade is reviewing how saved compounds, searches, preferences and alerts
          might reveal health interests. Public research records remain available without
          an account. We are not accepting new personal profiles during this review.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/intelligence" className="ink hard-sm press rounded-full bg-[#111214] px-5 py-3 text-sm font-bold text-white">Explore public research</Link>
          <Link href="/login" className="ink hard-sm press rounded-full bg-white px-5 py-3 text-sm font-bold">Sign in to an existing account</Link>
        </div>
        <p className="mt-6 text-xs leading-6 text-[var(--muted)]">
          Existing users can contact us about account data and deletion through the{" "}
          <Link href="/legal/privacy" className="font-bold text-[#2b31d8] underline">privacy notice</Link>.
        </p>
      </div>
    </section>
  );
}
