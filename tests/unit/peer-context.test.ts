import { describe, expect, it } from "vitest";
import { peerContext, isRemarkable, REMARKABLE_CEILING } from "@/server/verify/peer-context";

// A signal is only informative to the degree it moves a reader off what is normal. Nineteen of the
// fifty-eight vendors we hold a domain for have no Trustpilot profile; rendering that as a mark on
// nineteen vendor pages would turn an unremarkable fact into an accusation nineteen times over.
// The same fact stated with its base rate — "as with 19 of 58 tracked vendors" — reads correctly.
//
// The owner's phrasing for this was "level the playing field". This is that, as arithmetic.

describe("is a signal remarkable, or just normal here", () => {
  it("calls a rare signal remarkable", () => {
    expect(isRemarkable(14, 58)).toBe(true);   // a live rated profile: 24% of peers
    expect(isRemarkable(2, 90)).toBe(true);
  });

  it("calls a common signal unremarkable", () => {
    expect(isRemarkable(45, 58)).toBe(false);  // 78% of peers
    expect(isRemarkable(58, 58)).toBe(false);  // everyone
  });

  // The whole point of the ceiling: at exactly the threshold a signal stops distinguishing.
  it("treats the ceiling itself as unremarkable", () => {
    const n = Math.round(REMARKABLE_CEILING * 100);
    expect(isRemarkable(n, 100)).toBe(false);
    expect(isRemarkable(n - 1, 100)).toBe(true);
  });

  // One vendor out of five is not evidence of rarity, it is evidence of a small sample. Calling it
  // remarkable would let a thin catalogue manufacture significance.
  //
  // The ratios here are chosen to sit BELOW the ceiling on purpose. An earlier version used 1 of 3,
  // which is 33% and already unremarkable on ratio alone — so the test passed whether the
  // small-corpus guard existed or not, and deleting the guard broke nothing. A guard that cannot
  // fail is not a guard.
  it("refuses to judge rarity on a corpus too small to mean anything", () => {
    expect(1 / 5).toBeLessThan(REMARKABLE_CEILING);   // would be "remarkable" on ratio alone
    expect(isRemarkable(1, 5)).toBe(false);
    expect(1 / 7).toBeLessThan(REMARKABLE_CEILING);
    expect(isRemarkable(1, 7)).toBe(false);
    expect(isRemarkable(0, 0)).toBe(false);
  });
});

describe("stating a fact next to its base rate", () => {
  it("frames a common fact as ordinary", () => {
    const c = peerContext({ count: 19, total: 58, noun: "tracked vendor" });
    expect(c.remarkable).toBe(false);
    expect(c.phrase).toBe("as with 19 of 58 tracked vendors");
  });

  it("frames a rare fact as distinguishing", () => {
    const c = peerContext({ count: 14, total: 58, noun: "tracked vendor" });
    expect(c.remarkable).toBe(true);
    expect(c.phrase).toBe("one of only 14 of 58 tracked vendors");
  });

  it("says nothing at all when there is no corpus to compare against", () => {
    expect(peerContext({ count: 0, total: 0, noun: "tracked vendor" }).phrase).toBe("");
    expect(peerContext({ count: 3, total: 2, noun: "tracked vendor" }).phrase).toBe("");
  });

  it("keeps the singular readable", () => {
    expect(peerContext({ count: 1, total: 58, noun: "tracked vendor" }).phrase).toBe("the only 1 of 58 tracked vendors");
  });
});

describe("ranking a figure among peers", () => {
  it("names the top of the field", () => {
    const c = peerContext({ count: 14, total: 58, noun: "tracked vendor", rank: 1, rankedOf: 14, metric: "rating" });
    expect(c.rankPhrase).toBe("highest rating of 14 rated");
  });

  it("names a mid position without dressing it up", () => {
    const c = peerContext({ count: 14, total: 58, noun: "tracked vendor", rank: 7, rankedOf: 14, metric: "rating" });
    expect(c.rankPhrase).toBe("7th of 14 rated");
  });

  it("names the bottom plainly", () => {
    const c = peerContext({ count: 14, total: 58, noun: "tracked vendor", rank: 14, rankedOf: 14, metric: "rating" });
    expect(c.rankPhrase).toBe("lowest rating of 14 rated");
  });

  // A rank out of one is not a rank. Saying "highest of 1" implies a field that does not exist.
  it("refuses to rank against a field of one", () => {
    expect(peerContext({ count: 1, total: 58, noun: "tracked vendor", rank: 1, rankedOf: 1, metric: "rating" }).rankPhrase).toBe("");
  });

  it("omits the rank when none was supplied", () => {
    expect(peerContext({ count: 14, total: 58, noun: "tracked vendor" }).rankPhrase).toBe("");
  });
});
