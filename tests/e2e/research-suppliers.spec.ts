import { expect, test } from "@playwright/test";

test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only preview");

// The supplier-grades lens folded into the vendor directory: its address only forwards there.
test("the old supplier grades address forwards to the vendor directory", async ({ page, request }) => {
  const hop = await request.get("/intelligence/suppliers", { maxRedirects: 0 });
  expect([307, 308]).toContain(hop.status());
  expect(hop.headers().location).toBe("/vendors");
  await page.goto("/intelligence/suppliers");
  if (process.env.VIALGRADE_PUBLIC_BROWSE === "true") {
    await expect(page).toHaveURL(/\/vendors$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Explore vendors through documented evidence");
  } else {
    await expect(page).toHaveURL(/\/intelligence\?notice=retired$/);
  }
});

test("old shop routes stay retired", async ({ page, request }) => {
  const res = await request.post("/api/v1/commerce/checkout", { data: {} });
  expect(res.status()).toBe(410);
  await page.goto("/products/anything");
  await expect(page).toHaveURL(/\/intelligence/);
  expect((await request.get("/go/anything", { maxRedirects: 0 })).status()).toBe(410);
});
