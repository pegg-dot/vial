import { describe, expect, it } from "vitest";
import { isReadable } from "@/server/public-repository";

// The homepage decides between "here is the market" and an outage notice reading "We can't reach
// the catalogue right now... they are not zero, and nothing has been lost."
//
// It used to decide with `if (!catalog || !labTests)`, and getCertificatesOnRecord returns a
// NUMBER. Zero is falsy. So a site holding no lab tests — a new deployment, a fresh database, the
// test harness — published an outage notice claiming its data was unreachable and explicitly
// asserting the figures were "not zero", when they were exactly zero and nothing was wrong.
//
// A confidently wrong statement dressed as an incident. That is the failure mode this product
// exists to catch in other people's marketing, so it is not one to ship to our own readers.
// Failure is null. Zero is an answer.
describe("deciding an outage from a reading", () => {
  it("treats a failed read as unreadable", () => {
    expect(isReadable({ catalog: null, certificates: 12 })).toBe(false);
    expect(isReadable({ catalog: {}, certificates: null })).toBe(false);
    expect(isReadable({ catalog: null, certificates: null })).toBe(false);
  });

  // The case that was broken.
  it("does NOT call zero certificates an outage", () => {
    expect(isReadable({ catalog: {}, certificates: 0 })).toBe(true);
  });

  it("passes a normal reading through", () => {
    expect(isReadable({ catalog: {}, certificates: 289 })).toBe(true);
  });
});
