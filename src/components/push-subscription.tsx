"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";

type State = "loading" | "disabled" | "unsupported" | "denied" | "off" | "on" | "working";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

// The "enable delivery" control on the notifications page. Registers the service worker,
// requests permission, subscribes with the VAPID public key, and stores the subscription.
export function PushSubscription({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    const set = (next: State) => { if (!cancelled) setState(next); };
    void (async () => {
      if (!vapidPublicKey) return set("disabled");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return set("unsupported");
      if (Notification.permission === "denied") return set("denied");
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        set(subscription ? "on" : "off");
      } catch {
        set("off");
      }
    })();
    return () => { cancelled = true; };
  }, [vapidPublicKey]);

  async function enable() {
    if (!vapidPublicKey) return;
    setState("working");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const response = await fetch("/api/v1/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      setState(response.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }

  async function disable() {
    setState("working");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/v1/push/unsubscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  const message: Record<State, string> = {
    loading: "Checking delivery status…",
    disabled: "Push delivery is not configured on this deployment.",
    unsupported: "This browser can’t receive push notifications.",
    denied: "Notifications are blocked in your browser settings. Re-enable them there to receive change alerts.",
    off: "Get a notification the moment a reviewed change lands on a listing you follow.",
    on: "Delivery is on. You’ll be notified when a reviewed change occurs.",
    working: "One moment…",
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-black/[.07] bg-white p-5">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 place-items-center rounded-2xl ${state === "on" ? "bg-emerald-50 text-emerald-700" : "bg-black/[.04] text-black/40"}`}>
          {state === "on" ? <BellRing className="size-5" /> : <BellOff className="size-5" />}
        </span>
        <div>
          <p className="text-sm font-semibold">Push delivery</p>
          <p className="mt-1 max-w-md text-xs leading-5 text-[var(--muted)]">{message[state]}</p>
        </div>
      </div>
      {state === "off" && <button onClick={enable} className="rounded-full bg-[#111214] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black/85">Enable delivery</button>}
      {state === "on" && <button onClick={disable} className="rounded-full border border-black/[.1] px-5 py-2.5 text-sm font-semibold transition hover:bg-black/[.03]">Turn off</button>}
      {state === "working" && <span className="text-xs text-[var(--muted)]">Working…</span>}
    </div>
  );
}
