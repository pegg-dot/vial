import { describe, expect, it } from "vitest";
import { partnerHeadline, partnerCountingNote } from "@/server/outbound/partner-claim";

// The sentence a vendor reads first. It is the single most damaging place in the product to
// overstate: the vendor's own analytics is the very next thing they open, and a number that does
// not survive that check ends the conversation permanently.
describe("the vendor-facing pitch never overstates what we sent", () => {
  const base = { vendorName: "Acme Peptides", clicks: 12, visitorDays: 9, periodDays: 30 };

  it("does not call a click a buyer when nothing has been bought", () => {
    const line = partnerHeadline({ ...base, conversions: 0 });
    expect(line.toLowerCase()).not.toContain("buyer");
    expect(line).toContain("12");
    expect(line).toContain("Acme Peptides");
  });

  it("counts orders as orders only once a vendor has confirmed them", () => {
    const line = partnerHeadline({ ...base, conversions: 3 });
    expect(line).toContain("3 confirmed orders");
  });

  it("says nothing about orders when there are none", () => {
    expect(partnerHeadline({ ...base, conversions: 0 })).not.toContain("confirmed order");
  });

  it("reads correctly for a single click", () => {
    const line = partnerHeadline({ ...base, clicks: 1, conversions: 0 });
    expect(line).toContain("1 click-through");
    expect(line).not.toContain("1 click-throughs");
  });

  it("states the counting unit instead of implying distinct people", () => {
    const note = partnerCountingNote({ visitorDays: 9, periodDays: 30 });
    expect(note.toLowerCase()).toContain("once a day");
    expect(note).toContain("9");
  });
});
