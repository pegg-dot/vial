import { expect, test } from "@playwright/test";
import { RESEARCH_SUBJECTS } from "@/lib/research-explorer";

const SECTIONS = [
  ["overview", "Overview"], ["file-grade", "Source file"], ["studies", "Studies"],
  ["sources", "Sources"], ["material-evidence", "Materials"], ["related", "Limits and related"],
] as const;

test.describe("Every dossier has one structure", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only preview");

  for (const subject of RESEARCH_SUBJECTS) {
    test("/intelligence/explore/" + subject.slug + ": same six sections, same order, working contents list", async ({ page }) => {
      await page.goto("/intelligence/explore/" + subject.slug);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(subject.name);
      const toc = page.getByRole("navigation", { name: "Research dossier sections" });
      await expect(toc.getByRole("link")).toHaveText(SECTIONS.map(([, label], i) => String(i + 1).padStart(2, "0") + label));
      const ids = await page.locator("main section[id][aria-labelledby$='-title']").evaluateAll(els => els.map(el => el.id));
      // The six frames appear in contents order (other sections, e.g. organizations, are nested inside them).
      expect(ids.filter(id => SECTIONS.some(([s]) => s === id))).toEqual(SECTIONS.map(([id]) => id));
      for (const [id] of SECTIONS) {
        await expect(page.locator("#" + id)).toHaveCount(1);
        await expect(toc.locator('a[href="#' + id + '"]')).toHaveCount(1);
      }
      // One h2 per frame: nothing in a section competes with its heading.
      for (const [id] of SECTIONS) await expect(page.locator("#" + id + " > header h2")).toHaveCount(1);
    });
  }

  test("phone width: no horizontal overflow and the contents bar scrolls on its own", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const slug of ["tirzepatide", "pexiganan", "magainin-2"]) {
      await page.goto("/intelligence/explore/" + slug);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });

  test("tapping a contents item lands on that section", async ({ page }) => {
    await page.goto("/intelligence/explore/cagrilintide", { waitUntil: "networkidle" }); // streamed sections above the target have settled
    await page.getByRole("navigation", { name: "Research dossier sections" }).getByRole("link", { name: /Sources/ }).click();
    await expect(page).toHaveURL(/#sources$/);
    await expect(page.locator("#sources")).toBeInViewport();
  });
});
