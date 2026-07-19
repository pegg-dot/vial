export type SellerConnectorProvider =
  | "shopify"
  | "woocommerce"
  | "csv"
  | "website"
  | "stripe_connect"
  | "generic_webhook"
  | "vial_mcp";

export interface ConnectorDefinition {
  provider: SellerConnectorProvider;
  name: string;
  description: string;
  category: "commerce" | "catalog" | "payments" | "automation";
  capabilities: string[];
  setup: "oauth" | "credentials" | "upload" | "discovery" | "generated";
  recommended: boolean;
  productionRequiresExternalCredentials: boolean;
}

export const connectorDefinitions: ConnectorDefinition[] = [
  {
    provider: "shopify",
    name: "Shopify",
    description: "Import products, variants, inventory, and order events from a Shopify store.",
    category: "commerce",
    capabilities: ["catalog:read", "inventory:read", "orders:read", "webhooks:receive"],
    setup: "oauth",
    recommended: true,
    productionRequiresExternalCredentials: true,
  },
  {
    provider: "woocommerce",
    name: "WooCommerce",
    description: "Connect a WooCommerce store using REST API credentials and signed webhooks.",
    category: "commerce",
    capabilities: ["catalog:read", "inventory:read", "orders:read", "webhooks:receive"],
    setup: "credentials",
    recommended: true,
    productionRequiresExternalCredentials: true,
  },
  {
    provider: "csv",
    name: "CSV or spreadsheet",
    description: "Upload a product export and map columns before importing anything.",
    category: "catalog",
    capabilities: ["catalog:import", "inventory:import", "dry_run"],
    setup: "upload",
    recommended: true,
    productionRequiresExternalCredentials: false,
  },
  {
    provider: "website",
    name: "Website discovery",
    description: "Scan a seller-provided public catalog URL and propose product matches for review.",
    category: "catalog",
    capabilities: ["catalog:discover", "evidence:discover", "dry_run"],
    setup: "discovery",
    recommended: false,
    productionRequiresExternalCredentials: false,
  },
  {
    provider: "stripe_connect",
    name: "Stripe Connect",
    description: "Collect connected-account requirements through hosted or embedded onboarding.",
    category: "payments",
    capabilities: ["identity:collect", "requirements:track", "payouts:prepare"],
    setup: "oauth",
    recommended: true,
    productionRequiresExternalCredentials: true,
  },
  {
    provider: "generic_webhook",
    name: "Generic webhooks",
    description: "Receive signed product, inventory, order, and evidence lifecycle events.",
    category: "automation",
    capabilities: ["webhooks:receive", "events:verify"],
    setup: "generated",
    recommended: false,
    productionRequiresExternalCredentials: false,
  },
  {
    provider: "vial_mcp",
    name: "VIAL Seller MCP",
    description: "Give an approved AI operator scoped tools for onboarding, matching, catalog, and evidence gaps.",
    category: "automation",
    capabilities: ["tools:read", "catalog:propose", "evidence:propose", "approval_required"],
    setup: "generated",
    recommended: false,
    productionRequiresExternalCredentials: false,
  },
];

export function getConnectorDefinition(provider: string) {
  return connectorDefinitions.find((definition) => definition.provider === provider) ?? null;
}

export function sandboxCatalog(provider: SellerConnectorProvider) {
  const common = [
    {
      externalId: `${provider}:bpc-10`,
      title: "BPC 157 Research Vial 10mg",
      description: "Lyophilized research material. Batch information available separately.",
      sku: "BPC10-VIAL",
      price: 54,
      inventory: 18,
      tags: ["BPC157", "10 mg", "research"],
    },
    {
      externalId: `${provider}:ghk-50`,
      title: "GHK-Cu 50 mg",
      description: "Copper peptide research material.",
      sku: "GHK50-CU",
      price: 63,
      inventory: 9,
      tags: ["GHK-Cu", "50mg"],
    },
    {
      externalId: `${provider}:unknown`,
      title: "Recovery Blend 12 mg",
      description: "Legacy catalog label requiring manual canonical mapping.",
      sku: "BLEND12",
      price: 78,
      inventory: 4,
      tags: ["blend", "manual review"],
    },
  ];
  return common;
}

export function buildShopifyInstallUrl(input: { shop: string; clientId: string; redirectUri: string; state: string; scopes?: string[] }) {
  const shop = input.shop.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) throw new Error("Invalid Shopify hostname");
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("scope", (input.scopes ?? ["read_products", "read_inventory", "read_orders"]).join(","));
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}
