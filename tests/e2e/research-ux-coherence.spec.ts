import { expect, test } from "@playwright/test";

test.describe("Research UX coherence: context, honesty and reach", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only preview");

  test("Journey B: PMID 36781451 → review, then trace to NCT01594762 in place, with a shareable URL", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/intelligence/verify");
    await page.getByRole("textbox", { name: "Exact NCT, PMID or CID" }).fill("PMID 36781451");
    await page.getByRole("button", { name: "Check record" }).click();
    const verifier = page.getByRole("region", { name: "Original research source verification" });
    await expect(verifier).toContainText("secondary review");
    // The caveat that stops a reader treating a review as trial results is on screen without scrolling.
    await expect(verifier.getByText("A review article is not the study's primary clinical results report.")).toBeInViewport();
    await expect(page).toHaveURL(/ref=PMID(\+|%20)36781451/);
    await verifier.getByRole("button", { name: "Check NCT01594762" }).click();
    await expect(verifier).toContainText("OneStep-2");
    await expect(page).toHaveURL(/ref=NCT01594762/);
    await page.reload();
    await expect(verifier).toContainText("OneStep-2");
  });

  test("verifier separates a malformed input from a well-formed identifier that is not on file", async ({ page }) => {
    await page.goto("/intelligence/verify?ref=banana");
    const verifier = page.getByRole("region", { name: "Original research source verification" });
    await expect(verifier.getByRole("heading", { name: "Not a recognised identifier format" })).toBeVisible();
    await expect(verifier).toContainText("nothing was looked up");
    await page.goto("/intelligence/verify?ref=NCT99999999");
    await expect(verifier.getByRole("heading", { name: "Not checked in this evidence file" })).toBeVisible();
  });

  test("Journey F: sponsor links are reachable touch targets and attribution stays historical", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/intelligence/organizations");
    const link = page.getByRole("link", { name: "Open source NCT00563394" });
    await expect(link).toBeVisible({ timeout: 30000 });
    const box = (await link.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
    await expect(page.locator("main")).toContainText("not current corporate ownership");
  });

  test("retired shopping URLs keep research intent without reopening commerce", async ({ page, request }) => {
    await page.goto("/compounds/pexiganan");
    await expect(page).toHaveURL(/\/intelligence\/explore\/pexiganan$/);
    await page.goto("/compounds");
    await expect(page).toHaveURL(/\/intelligence\/market$/);
    await page.goto("/compounds/bpc-157");
    await expect(page).toHaveURL(/\/intelligence\?notice=retired$/);
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/intelligence\?notice=retired$/);
    expect((await request.post("/api/v1/commerce/checkout", { data: {} })).status()).toBe(410);
  });
});
