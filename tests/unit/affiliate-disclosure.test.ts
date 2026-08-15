import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AFFILIATE_RULES } from "@/server/outbound/affiliate";

// The guard that stops monetization shipping silently.
//
// AFFILIATE_RULES is empty today, and server/outbound/affiliate.ts is explicitly built so that
// adding one line there starts earning commission with NO UI change. That is exactly the failure
// mode 16 CFR 255.5 is about: the day a rule lands, the buy button becomes a paid link, and nothing
// in the build would otherwise notice that the disclosure next to it never appeared.
//
// So the invariant is not "the disclosure exists" — it is "a rule cannot exist without it".

const BUTTON_SOURCE_PATH = fileURLToPath(new URL("../../src/components/product-actions.tsx", import.meta.url));
const source = readFileSync(BUTTON_SOURCE_PATH, "utf8");

/** The sentence a reader must see next to the outbound link. Kept in sync with the component. */
const DISCLOSURE = "Some vendor links may earn VialGrade a commission.";

const disclosureRequired = (rules: Record<string, unknown>) => Object.keys(rules).length > 0;
const disclosurePresent = (buttonSource: string) => buttonSource.includes(DISCLOSURE);
/** False only in the state that must never ship: money is being earned, nothing says so. */
const satisfied = (rules: Record<string, unknown>, buttonSource: string) =>
  !disclosureRequired(rules) || disclosurePresent(buttonSource);

describe("affiliate disclosure — required before any rule can earn", () => {
  it("holds for the affiliate rules actually compiled into the app", () => {
    expect(satisfied(AFFILIATE_RULES, source)).toBe(true);
  });

  it("bites: a live rule with the disclosure removed is a failure", () => {
    // Proves this file is not vacuously green while AFFILIATE_RULES happens to be empty.
    expect(satisfied({ "some-vendor": { kind: "params" } }, "no disclosure in here")).toBe(false);
    expect(satisfied({ "*": { kind: "template" } }, source)).toBe(true);
  });

  it("keeps the disclosure standing next to the outbound link, not hidden behind a control", () => {
    expect(source).toContain("/go?l=");            // this is the component that links out
    expect(disclosurePresent(source)).toBe(true);  // present today, before any deal exists
    expect(source).toContain("{AFFILIATE_DISCLOSURE}"); // rendered, not just declared
    // No <details>, no toggle, no state gate around it — a collapsed disclosure is not a disclosure.
    expect(source).not.toMatch(/<details[\s\S]*AFFILIATE_DISCLOSURE/);
  });

  it("still tells crawlers the outbound link is sponsored", () => {
    expect(source).toContain("nofollow sponsored");
  });
});
