import { NextResponse } from "next/server";
import { requireSellerBearerScope } from "@/server/auth/seller-token";
import { getDatabase } from "@/server/db/client";
export async function GET(request: Request) { const gate = await requireSellerBearerScope(request, "catalog:read"); if (gate.response) return gate.response; const db = await getDatabase(); const rows = await db.query(`SELECT p.id,p.title,p.quantity_label,p.sku,p.price,p.inventory,p.status,p.match_confidence,e.display_name compound_name FROM seller_products p LEFT JOIN canonical_entities e ON e.id=p.compound_entity_id WHERE p.seller_id=$1 ORDER BY p.updated_at DESC`, [gate.auth!.sellerId]); return NextResponse.json({ products: rows.rows }); }
