import { CartPageClient } from "@/components/cart-page-client";
export const metadata = { title: "Sandbox cart" };
export default function CartPage() {
  return <section className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-600">Commerce sandbox</p><h1 className="mt-3 text-5xl font-semibold tracking-[-.06em]">Cart</h1><p className="mb-9 mt-4 max-w-2xl text-[var(--muted)]">A complete multi-seller cart running against fictional products and a test payment provider.</p><CartPageClient /></section>;
}
