import { describe, expect, it } from "vitest";
import { buildShopifyInstallUrl, connectorDefinitions } from "@/server/seller/connectors";
import { principalHasSellerPermission, sellerPermissionsForPrincipal } from "@/server/auth/seller-permissions";
import type { Principal } from "@/server/auth/types";

function seller(roles: Principal["roles"]): Principal { return { id: "seller-user", email: "seller@test", displayName: "Seller", accountType: "seller", roles, status: "active", sessionId: "session", expiresAt: Date.now() + 60_000 }; }

describe("seller platform contracts", () => {
  it("keeps seller roles least privilege", () => {
    expect(principalHasSellerPermission(seller(["seller_owner"]), "seller:tokens:manage")).toBe(true);
    expect(principalHasSellerPermission(seller(["seller_finance"]), "seller:catalog:write")).toBe(false);
    expect(principalHasSellerPermission(seller(["seller_operations"]), "seller:inventory:manage")).toBe(true);
    expect(principalHasSellerPermission(seller(["seller_support"]), "seller:finance:read")).toBe(false);
    expect(sellerPermissionsForPrincipal(seller(["seller_finance"]))).toContain("seller:finance:read");
  });

  it("generates a constrained Shopify OAuth URL", () => {
    const url = new URL(buildShopifyInstallUrl({ shop: "demo-store.myshopify.com", clientId: "client", redirectUri: "https://vial.test/api/callback", state: "signed-state" }));
    expect(url.hostname).toBe("demo-store.myshopify.com");
    expect(url.searchParams.get("scope")).toContain("read_products");
    expect(() => buildShopifyInstallUrl({ shop: "evil.example.com", clientId: "x", redirectUri: "https://vial.test", state: "x" })).toThrow();
  });

  it("exposes catalog, payment, and automation connectors", () => {
    expect(connectorDefinitions.some((item) => item.provider === "shopify" && item.setup === "oauth")).toBe(true);
    expect(connectorDefinitions.some((item) => item.provider === "stripe_connect" && item.category === "payments")).toBe(true);
    expect(connectorDefinitions.some((item) => item.provider === "vial_mcp" && item.capabilities.includes("approval_required"))).toBe(true);
  });
});
