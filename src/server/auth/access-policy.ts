import type { SessionEnvelope } from "./session-envelope";

export interface AccessDecision {
  protected: boolean;
  allowed: boolean;
  loginPath?: string;
}

export function accessDecision(path: string, session: SessionEnvelope | null): AccessDecision {
  if (path === "/admin/login" || path === "/login" || path === "/sell" || path.startsWith("/api/v1/auth/")) {
    return { protected: false, allowed: true };
  }
  if (path.startsWith("/admin")) {
    return { protected: true, allowed: session?.accountType === "staff", loginPath: "/admin/login" };
  }
  if (path.startsWith("/seller")) {
    return { protected: true, allowed: session?.accountType === "seller" || session?.accountType === "staff", loginPath: "/login" };
  }
  if (path === "/lab" || path.startsWith("/lab/")) {
    return { protected: true, allowed: session?.accountType === "laboratory" || session?.accountType === "staff", loginPath: "/login" };
  }
  if (
    path.startsWith("/account") ||
    path === "/watchlist" ||
    path === "/for-you" ||
    path === "/saved-searches" ||
    path === "/cart" ||
    path === "/checkout" ||
    path.startsWith("/orders/")
  ) {
    return { protected: true, allowed: session?.accountType === "customer", loginPath: "/login" };
  }
  return { protected: false, allowed: true };
}
