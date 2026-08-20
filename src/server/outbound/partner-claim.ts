// The words we put in front of a vendor.
//
// This lives in its own module, tested, rather than inline in the page, because it is the single
// most damaging place in the product to overstate. The page used to read "VialGrade sent <vendor>
// N buyers" where N was the raw CLICK count and confirmed orders were zero — three separate
// overstatements in one sentence. The first thing a vendor does is open their own analytics; a
// number that does not survive that check ends the conversation permanently.
//
// The rule encoded here: say only what the data supports. A click is a click until a vendor tells
// us it became an order.

export interface PartnerClaimInput {
  vendorName: string;
  clicks: number;
  visitorDays: number;
  conversions: number;
  periodDays: number;
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** The headline claim. Never says "buyer" — we cannot see a purchase unless a vendor reports it. */
export function partnerHeadline(input: PartnerClaimInput): string {
  const sent = plural(input.clicks, "click-through", "click-throughs");
  const orders = input.conversions > 0 ? ` and ${plural(input.conversions, "confirmed order", "confirmed orders")}` : "";
  return `VialGrade sent ${input.vendorName} ${sent}${orders} in ${input.periodDays} days — free.`;
}

/**
 * States the counting unit rather than implying a distinct-person total.
 *
 * The visitor hash is salted per calendar day so nobody can be followed across days; the direct
 * consequence is that one person clicking on three days counts three times. Saying so costs us a
 * smaller-sounding number and buys the only thing that matters here: the vendor can reproduce it.
 */
export function partnerCountingNote(input: { visitorDays: number; periodDays: number }): string {
  return `That is ${plural(input.visitorDays, "visitor", "visitors")} over ${input.periodDays} days, counted once a day — we use no cookies and no accounts, so someone returning on another day counts again.`;
}
