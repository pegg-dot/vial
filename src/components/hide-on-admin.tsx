"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Staff pages carry their own navigation bar. Under the public header they showed two stacked
 * navigations (Market / Compare / Existing account above Sources / Capture / Review), and the
 * public one is the wrong menu for a staff member. The sign-in page keeps the public chrome.
 */
export function HideOnAdmin({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin") && pathname !== "/admin/login") return null;
  return <>{children}</>;
}
