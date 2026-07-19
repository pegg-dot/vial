import { CheckoutClient } from "@/components/checkout-client";
import { requirePrincipal } from "@/server/auth/principal";

export const metadata = { title: "Approved commerce checkout" };

export default async function CheckoutPage() {
  const principal = await requirePrincipal({ accountTypes: ["customer"] });
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-12 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-600">VIAL 5 commerce</p>
      <h1 className="mt-3 text-5xl font-semibold tracking-[-.06em]">Policy-gated checkout</h1>
      <p className="mb-9 mt-4 max-w-3xl text-[var(--muted)]">VIAL evaluates seller underwriting, provider capabilities, SKU eligibility, customer type, destination, evidence, fraud, tax, and merchant model before creating a payment intent.</p>
      <CheckoutClient customerEmail={principal.email} />
    </section>
  );
}
