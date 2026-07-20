"use client";

import { useEffect } from "react";

// Registers the service worker once on load — this is what makes VIAL installable
// and offline-capable, and is a prerequisite for receiving push notifications.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures are non-fatal — the app works without offline/push.
      });
    }
  }, []);
  return null;
}
