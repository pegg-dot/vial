"use client";

import { useEffect } from "react";

/**
 * Old versions used a caching/push service worker on the same origin. The
 * research-only release must stop that worker serving previously cached vendor
 * pages or triggering notifications. This retires ONLY VialGrade app-shell
 * caches and registrations for the current origin; it does not delete browser
 * research notes, credentials or unrelated application storage.
 */
export function ResearchWorkerRetirement() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => Promise.all(registrations
          .filter(registration => {
            try { return new URL(registration.scope).origin === window.location.origin; }
            catch { return false; }
          })
          .map(registration => registration.unregister())))
        .catch(() => {});
    }
    if ("caches" in window) {
      window.caches.keys()
        .then(keys => Promise.all(keys
          .filter(key => key.startsWith("vial-shell-"))
          .map(key => window.caches.delete(key))))
        .catch(() => {});
    }
  }, []);
  return null;
}
