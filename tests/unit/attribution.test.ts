import { describe, expect, it } from "vitest";
import { deviceOf, newClickRef, tagDestination, visitorHash, UTM_SOURCE } from "@/server/outbound/attribution";

describe("outbound attribution tagging", () => {
  it("tags a destination so the vendor sees us in THEIR analytics", () => {
    const url = new URL(tagDestination("https://swisschems.is/product/bpc-157/", {
      compoundSlug: "bpc-157", listingSlug: "swiss-chems-bpc-157", clickRef: "abc123",
    }));
    expect(url.searchParams.get("utm_source")).toBe(UTM_SOURCE);
    expect(url.searchParams.get("utm_medium")).toBe("referral");
    expect(url.searchParams.get("utm_campaign")).toBe("bpc-157");
    expect(url.searchParams.get("vg")).toBe("abc123");
    expect(url.origin + url.pathname).toBe("https://swisschems.is/product/bpc-157/");
  });

  // A storefront running its own campaign must not have it clobbered by our tagging.
  it("never overwrites a parameter the vendor's own URL already carries", () => {
    const tagged = tagDestination("https://v.com/p?utm_source=their-newsletter&utm_campaign=spring", {
      compoundSlug: "bpc-157", clickRef: "x1",
    });
    const url = new URL(tagged);
    expect(url.searchParams.get("utm_source")).toBe("their-newsletter");
    expect(url.searchParams.get("utm_campaign")).toBe("spring");
    expect(url.searchParams.get("vg")).toBe("x1"); // ours is still added where it doesn't collide
  });

  it("never breaks the handoff on an unparseable destination", () => {
    expect(tagDestination("not a url", { clickRef: "x" })).toBe("not a url");
  });

  it("issues unique, url-safe click refs", () => {
    const refs = new Set(Array.from({ length: 200 }, () => newClickRef()));
    expect(refs.size).toBe(200);
    for (const r of refs) expect(r).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("visitor hashing — counts people, cannot identify one", () => {
  const day = new Date("2026-08-13T12:00:00Z");

  it("is stable within a day for the same visitor", () => {
    expect(visitorHash("1.2.3.4", "UA", day)).toBe(visitorHash("1.2.3.4", "UA", day));
  });

  it("separates different visitors", () => {
    expect(visitorHash("1.2.3.4", "UA", day)).not.toBe(visitorHash("5.6.7.8", "UA", day));
  });

  // The privacy property: the same person is unlinkable across days.
  it("changes for the same visitor on a different day", () => {
    const tomorrow = new Date("2026-08-14T12:00:00Z");
    expect(visitorHash("1.2.3.4", "UA", day)).not.toBe(visitorHash("1.2.3.4", "UA", tomorrow));
  });

  it("never returns the raw address", () => {
    expect(visitorHash("1.2.3.4", "UA", day)).not.toContain("1.2.3.4");
  });
});

describe("device classification", () => {
  it("classifies the common cases", () => {
    expect(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("mobile");
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
    expect(deviceOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)")).toBe("desktop");
    expect(deviceOf(null)).toBe("unknown");
  });
});
