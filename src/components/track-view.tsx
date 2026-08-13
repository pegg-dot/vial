"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Fires one page view per navigation.
 *
 * Uses sendBeacon where available so a view still records when the reader immediately clicks
 * through to a vendor — which is exactly the visit we most want to count, since it is the one that
 * becomes a buyer. Admin paths are excluded so our own use never inflates the numbers.
 */
export function TrackView() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    const body = JSON.stringify({ path: pathname });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track/view", new Blob([body], { type: "application/json" }));
        return;
      }
    } catch {
      /* fall through to fetch */
    }
    void fetch("/api/track/view", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  }, [pathname]);

  return null;
}
