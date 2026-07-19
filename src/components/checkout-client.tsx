"use client";

import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCommerceCart } from "./commerce-cart-provider";
import { StripePaymentPanel } from "./stripe-payment-panel";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
type ActivationCheck = { key: string; label: string; passed: boolean; required: boolean; detail: string };
type Preflight = { decision: string; mode: string; provider: string; chargeModel: string; merchantOfRecord: string; checks: ActivationCheck[] };
type PendingPayment = { clientSecret: string; attemptId: string; status: string; provider: string };

export function CheckoutClient({ customerEmail }: { customerEmail: string }) {
  const { cart, refresh } = useCommerceCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);

  useEffect(() => {
    if (!cart?.lines.length) return;
    let active = true;
    fetch("/api/v1/commerce/activation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerType: "sandbox_customer", jurisdiction: "US-SANDBOX" }) })
      .then((response) => response.json())
      .then((payload) => { if (active) setPreflight(payload.activation ?? null); })
      .catch(() => { if (active) setPreflight(null); });
    return () => { active = false; };
  }, [cart?.lines.length]);

  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    const region = String(formData.get("region")).trim().toUpperCase();
    const response = await fetch("/api/v1/commerce/approved-checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerType: "sandbox_customer",
        jurisdiction: region ? `US-${region}` : "US-SANDBOX",
        address: {
          line1: String(formData.get("line1")),
          city: String(formData.get("city")),
          region,
          postalCode: String(formData.get("postalCode")),
        },
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Checkout failed");
      setBusy(false);
      return;
    }
    if (!payload.orderId) {
      if (payload.clientSecret && payload.checkoutAttemptId) {
        setPendingPayment({ clientSecret: payload.clientSecret, attemptId: payload.checkoutAttemptId, status: payload.status, provider: payload.activation?.provider || "stripe" });
        setBusy(false);
        return;
      }
      setError(`Payment requires another provider step: ${payload.status}`);
      setBusy(false);
      return;
    }
    await refresh();
    router.push(`/orders/${encodeURIComponent(payload.orderId)}/confirmation`);
  }

  if (!cart || !cart.lines.length) return <p className="rounded-2xl bg-white p-8">Your cart is empty.</p>;

  return (
    <form action={submit} className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-black/[.07] bg-white p-6">
          <h2 className="text-xl font-semibold">Contact and shipping</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 text-sm font-medium">Account email<input name="email" type="email" readOnly value={customerEmail} className="field mt-2 bg-black/[.03] text-black/60" /></label>
            <label className="sm:col-span-2 text-sm font-medium">Address<input name="line1" required defaultValue="100 Test Mode Way" className="field mt-2" /></label>
            <label className="text-sm font-medium">City<input name="city" required defaultValue="Miami" className="field mt-2" /></label>
            <label className="text-sm font-medium">State<input name="region" required defaultValue="FL" className="field mt-2" /></label>
            <label className="text-sm font-medium">Postal code<input name="postalCode" required defaultValue="33101" className="field mt-2" /></label>
          </div>
        </section>

        <section className="rounded-[28px] border border-black/[.07] bg-white p-6">
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-violet-700">Activation preflight</p><h2 className="mt-2 text-xl font-semibold">Every gate before payment</h2></div>{preflight && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${preflight.decision === "allow" ? "bg-emerald-100 text-emerald-700" : preflight.decision === "deny" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{preflight.decision}</span>}</div>
          {preflight ? <><p className="mt-3 text-xs text-black/45">{preflight.provider} · {preflight.mode} · {preflight.chargeModel.replaceAll("_", " ")} · merchant: {preflight.merchantOfRecord}</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{preflight.checks.map((check) => <div key={`${check.key}:${check.detail}`} className="flex gap-3 rounded-2xl bg-black/[.03] p-4">{check.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <XCircle className={`mt-0.5 size-4 shrink-0 ${check.required ? "text-red-600" : "text-amber-600"}`} />}<div><p className="text-sm font-semibold">{check.label}</p><p className="mt-1 text-xs leading-5 text-black/45">{check.detail}</p></div></div>)}</div></> : <p className="mt-4 text-sm text-black/45">Evaluating seller, SKU, customer, jurisdiction, evidence, and merchant-model gates…</p>}
        </section>

        <section className="rounded-[28px] border border-violet-200 bg-violet-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-violet-700">Provider adapter</p>
          {pendingPayment ? (
            <div className="mt-4 rounded-2xl border border-violet-200 bg-white p-5">
              <p className="mb-4 text-sm text-black/55">{pendingPayment.provider} returned <strong>{pendingPayment.status.replaceAll("_", " ")}</strong>. Confirm through the provider; the signed webhook will create the order exactly once.</p>
              <StripePaymentPanel clientSecret={pendingPayment.clientSecret} attemptId={pendingPayment.attemptId} onError={setError} onOrderReady={async (orderId) => { await refresh(); router.push(`/orders/${encodeURIComponent(orderId)}/confirmation`); }} />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-violet-200 bg-white p-5"><p className="font-mono text-sm">4242 4242 4242 4242</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm text-black/50"><span>12 / 34</span><span>123</span></div></div>
          )}
          <p className="mt-3 text-xs leading-5 text-violet-800">Mock mode completes immediately. Stripe test mode renders Payment Element after an approved payment intent is created; order finalization waits for a verified provider event.</p>
        </section>
      </div>
      <aside className="h-fit rounded-[28px] bg-black p-6 text-white">
        <div className="flex items-center gap-2"><ShieldCheck className="size-5"/><h2 className="text-xl font-semibold">Final review</h2></div>
        <div className="mt-5 space-y-4">{cart.lines.map((line) => <div key={line.id} className="flex justify-between gap-4 text-sm"><span className="text-white/65">{line.quantity} × {line.name}<small className="block">{line.vendor}</small></span><span>{money(line.unitPrice * line.quantity)}</span></div>)}</div>
        <div className="mt-6 flex justify-between border-t border-white/15 pt-5 text-2xl font-semibold"><span>Total</span><span>{money(cart.total)}</span></div>
        {error && <p className="mt-4 rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p>}
        <button disabled={busy || Boolean(pendingPayment) || !cart.eligible || preflight?.decision === "deny"} className="mt-6 w-full rounded-2xl bg-white py-3.5 text-sm font-semibold text-black disabled:opacity-50">{busy ? "Creating approved payment…" : pendingPayment ? "Payment confirmation pending" : "Create approved payment"}</button>
        <p className="mt-4 text-xs leading-5 text-white/45">Production transactions remain impossible unless environment, processor, seller, SKU, legal, jurisdiction, and policy gates independently pass.</p>
      </aside>
    </form>
  );
}
