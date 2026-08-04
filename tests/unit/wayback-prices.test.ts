import { describe, expect, it } from "vitest";
import { extractArchivedPrice, parseCdx, snapshotDate } from "@/server/ingest/wayback-prices";

describe("wayback price backfill", () => {
  it("extracts an Open Graph product price", () => {
    expect(extractArchivedPrice(`<meta property="product:price:amount" content="42.00">`)).toBe(42);
  });
  it("extracts a JSON-LD offer price", () => {
    expect(extractArchivedPrice(`<script type="application/ld+json">{"offers":{"price":"57.50","priceCurrency":"USD"}}</script>`)).toBe(57.5);
  });
  it("extracts a WooCommerce visible price node", () => {
    expect(extractArchivedPrice(`<span class="woocommerce-Price-amount amount"><bdi>$34.99</bdi></span>`)).toBe(34.99);
  });
  it("rejects out-of-range and junk values", () => {
    expect(extractArchivedPrice(`<meta property="product:price:amount" content="0.10">`)).toBeNull();
    expect(extractArchivedPrice(`<meta property="product:price:amount" content="99999">`)).toBeNull();
    expect(extractArchivedPrice(`<div>no price here</div>`)).toBeNull();
  });
  it("parses a CDX json response into snapshots (dropping the header row)", () => {
    const cdx = [["urlkey", "timestamp", "original", "statuscode"], ["k", "20240115120000", "https://v.com/p", "200"], ["k", "20250601000000", "https://v.com/p", "200"]];
    const snaps = parseCdx(cdx);
    expect(snaps).toHaveLength(2);
    expect(snaps[0]).toEqual({ timestamp: "20240115120000", original: "https://v.com/p" });
  });
  it("converts a snapshot timestamp to a date", () => {
    expect(snapshotDate("20240115120000").toISOString().slice(0, 10)).toBe("2024-01-15");
  });
});
