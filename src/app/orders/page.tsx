import type { Metadata } from "next";
import Link from "next/link";
import { requirePrincipal } from "@/server/auth/principal";

export const metadata: Metadata = { title: "Order history", robots: { index: false, follow: false } };

// Read-only explanation, no order data. Order pages belong to the retired marketplace; a signed-in
// customer who goes looking for them gets a reason and a way to ask, not a bare "page not found".
export default async function Page() {
  await requirePrincipal({ accountTypes: ["customer", "seller"] });
  return (
    <section className="mx-auto max-w-[900px] px-5 py-16 sm:px-8">
      <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#2b31d8]">Existing account</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-.05em]">Order history is no longer online</h1>
      <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
        VialGrade no longer runs a marketplace, so order pages are not shown here. If we still hold order or account
        records about you, you can ask for a copy, a correction or deletion through the privacy contact.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/legal/contact" className="ink hard-sm press rounded-full bg-[#111214] px-5 py-3 text-sm font-bold text-white">Contact us about your records</Link>
        <Link href="/account" className="ink hard-sm press rounded-full bg-white px-5 py-3 text-sm font-bold">Back to my account</Link>
      </div>
    </section>
  );
}
