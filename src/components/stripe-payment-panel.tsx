"use client";

import { PaymentElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { CreditCard, LoaderCircle } from "lucide-react";
import { useState } from "react";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

async function waitForOrder(attemptId: string) {
  for (let index = 0; index < 15; index += 1) {
    const response = await fetch(`/api/v1/commerce/checkout-status?attemptId=${encodeURIComponent(attemptId)}`, { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      if (payload.order_id) return String(payload.order_id);
      if (payload.status === "failed") throw new Error(payload.failure_reason || "Payment failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Payment was confirmed, but order finalization is still pending. Check your orders shortly.");
}

function ConfirmationForm({ attemptId, onOrderReady, onError }: { attemptId: string; onOrderReady: (orderId: string) => void; onError: (message: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!stripe || !elements) return;
    setBusy(true);
    onError("");
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/checkout?payment_return=1` },
      redirect: "if_required",
    });
    if (result.error) {
      onError(result.error.message || "Payment confirmation failed");
      setBusy(false);
      return;
    }
    try {
      const orderId = await waitForOrder(attemptId);
      onOrderReady(orderId);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Order finalization failed");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <button type="button" onClick={confirm} disabled={!stripe || !elements || busy} className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? <><LoaderCircle className="mr-2 inline size-4 animate-spin" />Confirming payment…</> : <><CreditCard className="mr-2 inline size-4" />Confirm with provider</>}
      </button>
    </div>
  );
}

export function StripePaymentPanel({ clientSecret, attemptId, onOrderReady, onError }: { clientSecret: string; attemptId: string; onOrderReady: (orderId: string) => void; onError: (message: string) => void }) {
  if (!stripePromise) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Stripe test mode requires <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>. The payment attempt remains pending.</div>;
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe", variables: { borderRadius: "12px", colorPrimary: "#111111" } } }}>
      <ConfirmationForm attemptId={attemptId} onOrderReady={onOrderReady} onError={onError} />
    </Elements>
  );
}
