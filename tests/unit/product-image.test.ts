import { describe, expect, it } from "vitest";
import { extractProductImage, normalizeImageUrl } from "@/server/ingest/product-image";

describe("product-image extraction", () => {
  it("pulls og:image (WordPress/WooCommerce shape)", () => {
    const html = `<head><meta property="og:image" content="https://nootropicsource.com/wp-content/uploads/DSIP-1.jpg"/></head>`;
    expect(extractProductImage(html, "https://nootropicsource.com/shop/peptides/dsip/")).toBe("https://nootropicsource.com/wp-content/uploads/DSIP-1.jpg");
  });
  it("upgrades an http og:image to https (avoids mixed content)", () => {
    const html = `<meta property="og:image" content="http://bluumpeptides.com/cdn/shop/files/bpc.webp?v=1">`;
    expect(extractProductImage(html, "https://bluumpeptides.com/products/bpc-157")).toBe("https://bluumpeptides.com/cdn/shop/files/bpc.webp?v=1");
  });
  it("falls back to twitter:image, then link rel=image_src", () => {
    expect(extractProductImage(`<meta name="twitter:image" content="https://x.com/a.png">`, "https://x.com")).toBe("https://x.com/a.png");
    expect(extractProductImage(`<link rel="image_src" href="https://x.com/b.png">`, "https://x.com")).toBe("https://x.com/b.png");
  });
  it("prefers og:image over the others when several are present", () => {
    const html = `<meta name="twitter:image" content="https://x.com/tw.png"><meta property="og:image" content="https://x.com/og.png">`;
    expect(extractProductImage(html, "https://x.com")).toBe("https://x.com/og.png");
  });
  it("resolves a relative image against the page URL", () => {
    expect(normalizeImageUrl("/img/vial.jpg", "https://vendor.com/shop/x")).toBe("https://vendor.com/img/vial.jpg");
    expect(normalizeImageUrl("//cdn.shopify.com/a.webp", "https://s.com")).toBe("https://cdn.shopify.com/a.webp");
  });
  it("returns null when there is no usable image", () => {
    expect(extractProductImage(`<head><title>no image</title></head>`, "https://x.com")).toBeNull();
    expect(normalizeImageUrl("data:image/png;base64,AAAA", "https://x.com")).toBeNull();
  });
});
