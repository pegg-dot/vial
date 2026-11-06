import { expect, test } from "@playwright/test";

test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only preview");

// Default build: the supplier lens is OFF. The page must say so and must not list organizations.
test("supplier grades page is honest when not switched on", async ({ page }) => {
  const res = await page.goto("/intelligence/suppliers");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: /not switched on yet/i })).toBeVisible();
  await expect(page.getByText(/price|buy now|add to cart|available from/i)).toHaveCount(0);
  await expect(page.locator("main h1")).toHaveCount(1);
});

test("old shop routes stay retired", async ({ page, request }) => {
  const res = await request.post("/api/v1/commerce/checkout", { data: {} });
  expect(res.status()).toBe(410);
  await page.goto("/vendors");
  await expect(page).not.toHaveURL(/\/vendors$/);
});
