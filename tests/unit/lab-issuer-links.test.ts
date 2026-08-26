import { describe, expect, it } from "vitest";
import { LAB_REGISTRY, getLabProfile } from "@/server/labs/registry";

// /research listed the labs named on the certificates we hold and linked every single tile to the
// bare `/labs` index — so clicking "Janoshik Analytical" did not open Janoshik, while the copy
// directly above said "open a lab to see what we could actually check". The tiles now resolve the
// raw issuer string through getLabProfile and link to /labs/<slug>.
//
// This is unit-tested rather than browser-tested because the seeded fixture holds no
// lab_test_records, so an e2e assertion on /research would pass vacuously.
describe("lab issuer resolution behind the /research tiles", () => {
  it("resolves every registered lab by its display name", () => {
    for (const lab of LAB_REGISTRY) {
      expect(getLabProfile(lab.displayName)?.slug, lab.displayName).toBe(lab.slug);
    }
  });

  it("resolves every alias the certificates actually carry", () => {
    // `aliases` is documented as "every raw string seen in COAs that should canonicalize to this
    // lab" — which is exactly what the issuer column holds, so each one must produce a link.
    for (const lab of LAB_REGISTRY) {
      for (const alias of lab.aliases) {
        expect(getLabProfile(alias)?.slug, `${lab.slug} alias "${alias}"`).toBe(lab.slug);
      }
    }
  });

  it("returns null for an unknown issuer so the tile stays a card instead of a dead link", () => {
    expect(getLabProfile("Some Lab We Have Never Heard Of")).toBeNull();
    expect(getLabProfile("")).toBeNull();
  });

  it("produces a slug that is safe in a URL path", () => {
    for (const lab of LAB_REGISTRY) expect(lab.slug).toMatch(/^[a-z0-9-]+$/);
  });
});
