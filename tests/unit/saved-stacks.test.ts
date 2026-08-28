import { describe, expect, it } from "vitest";
import { isStackKey, splitWatchlist, stackKey, stackSlugFromKey } from "@/lib/saved-stacks";

// One store holds saved listings and saved stacks; the "stack:" key is the only thing that tells
// them apart. If the split ever leaks a stack key into the listing slugs, personalisation and the
// digest start looking up a listing called "stack:klow".
describe("saved stacks share the watchlist store", () => {
  it("round-trips a stack slug through its key", () => {
    expect(stackKey("klow")).toBe("stack:klow");
    expect(isStackKey("stack:klow")).toBe(true);
    expect(isStackKey("chameleon-peptides-bpc-157")).toBe(false);
    expect(stackSlugFromKey("stack:klow")).toBe("klow");
  });
  it("splits one stored list into listing slugs and stack slugs, order kept", () => {
    expect(splitWatchlist(["a-listing", "stack:glow", "b-listing", "stack:klow"])).toEqual({ listings: ["a-listing", "b-listing"], stacks: ["glow", "klow"] });
    expect(splitWatchlist([])).toEqual({ listings: [], stacks: [] });
  });
});
