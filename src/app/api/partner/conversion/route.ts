import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getDatabase } from "@/server/db/client";

export const dynamic = "force-dynamic";

// Closes the attribution loop, for partners only.
//
// Every outbound link already carries `?vg=<clickRef>`. A partnered vendor posts that ref back on
// order confirmation and we can then state revenue we DROVE, order by order, rather than clicks we
// sent. This is the difference between "we sent you traffic" and "we made you $4,180 last month".
//
// Inert until a vendor has a program with a postback secret, so it costs nothing to ship now and is
// ready the day the first deal lands. Integration for the vendor is one HTTP call:
//
//   POST /api/partner/conversion
//   { "vendor": "chameleon-peptides", "ref": "<vg param>", "orderValueCents": 12900,
//     "currency": "USD", "signature": "<hmac-sha256 of `ref:orderValueCents` with the shared secret>" }

interface Body {
  vendor?: string; ref?: string; orderValueCents?: number; currency?: string; signature?: string;
}

function signatureMatches(secret: string, ref: string, cents: number, provided: string): boolean {
  const expected = createHmac("sha256", secret).update(`${ref}:${cents}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided ?? "");
  // Length check first: timingSafeEqual throws on a length mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  let body: Body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const vendor = String(body.vendor ?? "").trim();
  const ref = String(body.ref ?? "").trim();
  const cents = Number(body.orderValueCents ?? 0);
  if (!vendor || !ref || !Number.isFinite(cents) || cents < 0) {
    return NextResponse.json({ error: "vendor, ref and orderValueCents are required" }, { status: 400 });
  }

  const db = await getDatabase();
  const program = (await db.query<{ postback_secret: string | null }>(
    `SELECT postback_secret FROM partner_programs WHERE vendor_slug=$1 AND status='active'`, [vendor],
  )).rows[0];
  // Same response for "no program" and "bad signature" — never reveal which vendors are partnered.
  if (!program?.postback_secret || !signatureMatches(program.postback_secret, ref, cents, String(body.signature ?? ""))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only ever mark a click WE issued, for THIS vendor, and only once — a replayed postback must not
  // inflate revenue. The vendor_slug condition stops a partner claiming another vendor's click.
  const updated = await db.query(
    `UPDATE outbound_clicks
     SET converted_at=NOW(), order_value_cents=$3::int, order_currency=$4, conversion_source='postback'
     WHERE click_ref=$1 AND vendor_slug=$2 AND converted_at IS NULL`,
    [ref, vendor, Math.round(cents), String(body.currency ?? "USD").slice(0, 8)],
  );

  const matched = (updated.rowCount ?? 0) > 0;
  return NextResponse.json(
    { recorded: matched, reason: matched ? undefined : "unknown or already-recorded ref" },
    { status: 200 },
  );
}
