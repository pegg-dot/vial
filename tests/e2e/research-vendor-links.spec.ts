import { expect, test } from "@playwright/test";

// Fixture vendors are demo records with no stored domain, so the link itself is covered by the
// component markup test; here: off by default, and on with no domain the page still renders without one.
test.describe("Company-website link on vendor pages", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true" || process.env.VIALGRADE_PUBLIC_BROWSE !== "true", "Needs the browse release flags");

  test("a vendor page renders, with no outbound company link for a vendor with no stored domain", async ({ page }) => {
    const res = await page.goto("/vendors/arcwell-analytics");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("region", { name: "Company website" })).toHaveCount(0);
    await expect(page.locator("main h1").first()).toBeVisible();
  });
});
