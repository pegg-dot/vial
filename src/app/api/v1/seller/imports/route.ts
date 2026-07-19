import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSellerPermission } from "@/server/auth/principal";
import { getDatabase } from "@/server/db/client";
import { getSellerContext, runCatalogImport } from "@/server/seller/ops";

const rowSchema = z.object({ externalId: z.string().optional(), title: z.string().min(1), description: z.string().optional(), sku: z.string().optional(), price: z.number().nonnegative().optional(), inventory: z.number().int().nonnegative().optional(), tags: z.array(z.string()).optional() });
const schema = z.object({ provider: z.enum(["shopify", "woocommerce", "csv", "website", "stripe_connect", "generic_webhook", "vial_mcp"]), rows: z.array(rowSchema).max(500).optional() });

export async function GET() {
  const auth = await requireApiSellerPermission("seller:catalog:read");
  if (auth.response) return auth.response;
  const context = await getSellerContext(auth.principal.email);
  if (!context) return NextResponse.json({ error: "Seller workspace not found" }, { status: 404 });
  const db = await getDatabase();
  const jobs = await db.query(`SELECT * FROM seller_import_jobs WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 25`, [context.sellerId]);
  return NextResponse.json({ jobs: jobs.rows });
}

export async function POST(request: Request) {
  const auth = await requireApiSellerPermission("seller:catalog:write");
  if (auth.response) return auth.response;
  const context = await getSellerContext(auth.principal.email);
  if (!context) return NextResponse.json({ error: "Seller workspace not found" }, { status: 404 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid import payload", details: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await runCatalogImport({ sellerId: context.sellerId, provider: parsed.data.provider, rows: parsed.data.rows, actorId: auth.principal.id }));
}
