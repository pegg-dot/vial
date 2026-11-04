import { expect, test } from "@playwright/test";

const BANNED = ["buy", "shop", "price", "cart", "available from", "in stock", "supplier", "vendor", "purchase"];

test.describe("Organizations on record (dossier Sources A1)", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only preview");

  test("pexiganan lists each sponsor per registered study with its own registry link", async ({ page }) => {
    await page.goto("/intelligence/explore/pexiganan");
    const section = page.getByRole("region", { name: "Organizations on record" });
    await expect(section).toBeVisible();
    await expect(section.getByRole("listitem")).toHaveCount(4);
    await expect(section.getByText("Dipexium Pharmaceuticals, Inc.")).toHaveCount(2);
    await expect(section.getByText("Abeona Therapeutics, Inc")).toHaveCount(2);
    for (const link of await section.getByRole("link").all()) {
      expect(await link.getAttribute("href")).toMatch(/^https:\/\/clinicaltrials\.gov\/study\/NCT\d{8}$/);
    }
    await expect(section.getByText(/does not establish who originated/)).toBeVisible();
    const text = (await section.innerText()).toLowerCase();
    for (const word of BANNED) expect(text).not.toContain(word);
  });

  test("a compound with a pinned study shows a sourced row or an honest 'not confirmed' note, never an unlinked claim", async ({ page }) => {
    await page.goto("/intelligence/explore/tirzepatide");
    const section = page.getByRole("region", { name: "Organizations on record" });
    await expect(section).toBeVisible({ timeout: 15_000 });
    await expect(section.getByRole("link").first()).toBeVisible({ timeout: 15_000 });
    for (const link of await section.getByRole("link").all()) {
      expect(await link.getAttribute("href")).toMatch(/^https:\/\/clinicaltrials\.gov\/study\/NCT\d{8}$/);
    }
    const rows = await section.getByRole("listitem").count();
    if (rows === 0) await expect(section.getByText(/could not be matched|does not name a lead sponsor|not been read/)).toBeVisible();
  });

  test("a compound with no registered study on file lists nobody", async ({ page }) => {
    await page.goto("/intelligence/explore/magainin-2");
    const section = page.getByRole("region", { name: "Organizations on record" });
    await expect(section.getByText(/No registered study is on file/)).toBeVisible();
    await expect(section.getByRole("listitem")).toHaveCount(0);
  });
});
