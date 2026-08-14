// Attribution — the evidence that VialGrade drove the sale.
//
// The business model is: send vendors real buyers for free, prove it, then convert that proof into
// an affiliate/rev-share deal. That proof has to survive a sceptical vendor, so it is built in
// three layers of increasing strength, and the first two need NOTHING from the vendor:
//
//   1. THEIR OWN ANALYTICS (zero cooperation). Every outbound link carries utm_source=vialgrade.
//      Any vendor on Shopify, WooCommerce or GA already has a referral/source report — they open
//      their own dashboard and see our sessions AND the orders attributed to them. A number a
//      vendor reads in their own admin is worth more in a negotiation than any number we email.
//   2. OUR CLICK LEDGER (zero cooperation). Unique high-intent clicks per vendor, per compound,
//      over time, with a privacy-preserving visitor hash so "clicks" can be stated as "people".
//   3. CLOSED LOOP (needs one small thing from them). Either a coupon code — every use is provably
//      ours, no integration at all — or a postback to /api/partner/conversion carrying the click
//      ref we appended, which gives exact order-level revenue.
//
// No PII is stored. `visitor_hash` is a salted hash of IP+UA that rotates daily, so it can count
// distinct people within a day without being able to identify or track one across days.
export const attributionSchemaSql = String.raw`
ALTER TABLE outbound_clicks ADD COLUMN IF NOT EXISTS click_ref TEXT;
ALTER TABLE outbound_clicks ADD COLUMN IF NOT EXISTS visitor_hash TEXT;
ALTER TABLE outbound_clicks ADD COLUMN IF NOT EXISTS landing_path TEXT;
ALTER TABLE outbound_clicks ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE outbound_clicks ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE outbound_clicks ADD COLUMN IF NOT EXISTS order_value_cents INTEGER;
ALTER TABLE outbound_clicks ADD COLUMN IF NOT EXISTS order_currency TEXT;
ALTER TABLE outbound_clicks ADD COLUMN IF NOT EXISTS conversion_source TEXT;
ALTER TABLE outbound_clicks ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_outbound_clicks_ref ON outbound_clicks(click_ref);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_converted ON outbound_clicks(vendor_slug, converted_at);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_visitor ON outbound_clicks(visitor_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_human ON outbound_clicks(is_bot, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_programs (
  vendor_slug TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'prospect',
  coupon_code TEXT,
  postback_secret TEXT,
  rev_share_bps INTEGER,
  contact_email TEXT,
  notes TEXT,
  report_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_report_token ON partner_programs(report_token);
`;
