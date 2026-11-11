import { expect, test } from "@playwright/test";

test.describe("Research materials and source provenance", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only local preview");

  test("connects material review and supplier documentation without products or sales", async ({ page, request }) => {
    await page.goto("/intelligence");
    await expect(page.getByRole("link", { name: "Open material verification" }))
      .toHaveAttribute("href", "/intelligence/materials?subject=pexiganan");
    await page.getByRole("link", { name: "Open material verification" }).click();
    await expect(page.getByRole("heading", { name: "Research material checks" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pexiganan material file" })).toBeVisible();
    await expect(page.getByText("0 independently authenticated physical lots")).toBeVisible();
    await page.getByPlaceholder("Exact ID from the label").fill("ABC-123");
    await page.getByPlaceholder("Exact ID from the report").fill("ABC-12");
    await expect(page.getByRole("status")).toContainText("Conflict");
    await page.getByPlaceholder("Exact ID from the report").fill("ABC-123");
    await expect(page.getByRole("status")).toContainText("Authenticity still unverified");
    const [file] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download provisional workpaper" }).click(),
    ]);
    expect(file.suggestedFilename()).toContain("unverified");
    // The supplier documents are a section of this page now (the old index forwards here).
    await page.getByRole("link", { name: "Supplier quality documents" }).click();
    await expect(page.getByRole("heading", { name: "Who publishes the quality information?" })).toBeInViewport();
    await expect(page.getByRole("link", { name: "Inspect quality sources" })).toHaveCount(2);
    expect((await request.post("/api/v1/commerce/checkout", { data: {} })).status()).toBe(410);
  });

  test("keeps phone layouts within viewport and connects a compound dossier", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/intelligence/materials", "/intelligence/providers/bachem", "/compounds/pexiganan"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(391);
    }
    await expect(page.getByRole("link", { name: "Open material checks" }))
      .toHaveAttribute("href", "/intelligence/materials?subject=pexiganan");
    // The supplier-documentation index is a section of Material checks now; its address forwards there.
    const index = await page.request.get("/intelligence/providers", { maxRedirects: 0 });
    expect(index.status()).toBe(308);
    expect(index.headers().location).toBe("/intelligence/materials#material-providers");
    await page.goto("/intelligence/providers/bachem");
    await expect(page.getByRole("link", { name: "All documentation profiles" })).toHaveAttribute("href", "/intelligence/materials#material-providers");
  });
});
