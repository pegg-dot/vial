import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PriceSeries } from "@/components/price-series";

// The chart's text alternative is the same sentence a sighted reader gets, plus the data itself.
// A sparkline with an aria-label of "Price history from $34.95 to $29.95" told a screen-reader user
// a trend the sighted copy did not claim (the old component did exactly that).
describe("PriceSeries", () => {
  const points = [{ day: "2026-07-27", price: 34.95, available: true }, { day: "2026-08-17", price: 29.95, available: true }, { day: "2026-08-20", price: null, available: false }, { day: "2026-08-28", price: 29.95, available: true }];
  const html = renderToStaticMarkup(createElement(PriceSeries, { points, description: "−14.3 % over 30 days · 4 checks" }));

  it("labels the image with the visible description, not a synthetic sentence", () => {
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="−14.3 % over 30 days · 4 checks"');
    expect(html).not.toMatch(/Price history from/);
  });

  it("carries a data table of every point, including the unavailable one", () => {
    expect(html).toMatch(/<details/);
    expect(html).toContain("2026-08-20");
    expect(html).toMatch(/not available|unavailable/i);
  });

  it("draws a gap, not a line, through an unavailable day", () => {
    // Fails if a single polyline joins every point regardless of availability.
    expect((html.match(/<polyline/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
