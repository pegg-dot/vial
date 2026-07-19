import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSellerPermission } from "@/server/auth/principal";
import { connectorDefinitions } from "@/server/seller/connectors";
import { connectSandboxIntegration, getSellerContext } from "@/server/seller/ops";

const schema = z.object({ provider: z.enum(["shopify", "woocommerce", "csv", "website", "stripe_connect", "generic_webhook", "vial_mcp"]), settings: z.record(z.string(), z.unknown()).optional() });

export async function GET() {
  const auth = await requireApiSellerPermission("seller:profile:read");
  if (auth.response) return auth.response;
  const context = await getSellerContext(auth.principal.email);
  return NextResponse.json({ definitions: connectorDefinitions, connections: context?.integrations ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireApiSellerPermission("seller:integrations:manage");
  if (auth.response) return auth.response;
  const context = await getSellerContext(auth.principal.email);
  if (!context) return NextResponse.json({ error: "Seller workspace not found" }, { status: 404 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid integration payload" }, { status: 400 });
  return NextResponse.json(await connectSandboxIntegration({ sellerId: context.sellerId, provider: parsed.data.provider, settings: parsed.data.settings }));
}
