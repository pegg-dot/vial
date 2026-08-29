import { describe, expect, it } from "vitest";
import { classifyStorefrontBody } from "@/server/verify/vendor-status";

// Phase 1.5 of docs/superpowers/specs/2026-08-29-vial-price-truth-design.md. Both of these were
// reported "operating" in production: https://science.bio/ is a 200 whose title reads
// "Permanently Closed", and https://certifiedpep.com/ is a 200 that frames a domain-parking ad.
// A closed storefront is the end state this probe exists to catch.

const pad = (body: string) => body + " ".repeat(700);

describe("classifyStorefrontBody", () => {
  it("recognises a storefront that says it has permanently closed", () => {
    // Fails if the closure family is not in the pattern set.
    expect(classifyStorefrontBody(pad(`<html><head><title>Science Bio — Permanently Closed</title></head><body><h1>We have permanently closed.</h1><p>Thank you for your support over the years.</p></body></html>`))).toBe("closed");
  });

  it("recognises a domain-parking ad frame served with HTTP 200", () => {
    // Fails if parking-frame hosts are not in the pattern set.
    expect(classifyStorefrontBody(pad(`<html><body><iframe src="https://findresultsquick.com/caf/?ses=abc&amp;query=peptides"></iframe><script src="https://cdn-fileserver.com/js/safeframe.html"></script></body></html>`))).toBe("parked");
  });

  it("still calls a near-empty page parked and a normal storefront operating (control)", () => {
    expect(classifyStorefrontBody("<html><body>hi</body></html>")).toBe("parked");
    expect(classifyStorefrontBody(pad(`<html><head><title>Umbrella Labs — Research Peptides</title></head><body><nav>Shop Peptides Nootropics</nav><h1>BPC-157 5mg</h1><p>Add to cart</p></body></html>`))).toBe("operating");
  });
});
