import { expect, test } from "@playwright/test";

test.describe("compound directory", () => {
  // The directory rendered every compound with no search box at all — a buyer who arrived knowing
  // a name had only ctrl-F.
  test("keyword search narrows the table", async ({ page }) => {
    await page.goto("/compounds");
    const count = page.getByTestId("compound-count");
    const all = Number((await count.textContent())!.match(/\d+/)![0]);
    expect(all).toBeGreaterThan(1);

    await page.getByLabel("Search compounds").fill("bpc");
    const narrowed = Number((await count.textContent())!.match(/\d+/)![0]);
    expect(narrowed).toBeGreaterThan(0);
    expect(narrowed).toBeLessThan(all);
  });

  test("matches the shorthand and the aliases, not just the name", async ({ page }) => {
    await page.goto("/compounds");
    // "body protection compound" is BPC-157's alias, not its name. Matching `name` alone would
    // tell someone who typed it that we track nothing of the sort.
    await page.getByLabel("Search compounds").fill("body protection compound");
    await expect(page.getByTestId("compound-count")).toContainText("1 compound");
  });

  test("says so instead of rendering an empty table", async ({ page }) => {
    await page.goto("/compounds");
    await page.getByLabel("Search compounds").fill("zzzznotacompound");
    await expect(page.getByText(/No compounds match/)).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).last().click();
    await expect(page.getByText(/No compounds match/)).toBeHidden();
  });
});

test.describe("facets can always return something", () => {
  // Five of the nine shelves held zero listings in the catalogue. Clicking one scrolled the reader
  // into an empty grid, which reads as a broken filter rather than an empty shelf.
  test("every shelf pill on /market yields listings", async ({ page }) => {
    await page.goto("/market");
    const rail = page.locator(".scroll-fade-x").first();
    const pills = rail.getByRole("button");
    const total = await pills.count();
    expect(total).toBeGreaterThan(1);

    for (let index = 1; index < total; index += 1) {
      const label = (await pills.nth(index).textContent())?.trim();
      await pills.nth(index).click();
      const shown = await page.getByTestId("market-count").textContent();
      expect(Number(shown!.match(/\d+/)![0]), `shelf "${label}" is a dead filter`).toBeGreaterThan(0);
    }
  });

  test("/vendors offers no vendor kind it holds none of", async ({ page }) => {
    await page.goto("/vendors");
    const chips = page.getByRole("button", { name: /Everyone|Shops you can buy from|Upstream makers/ });
    const count = await chips.count();
    for (let index = 0; index < count; index += 1) {
      const label = (await chips.nth(index).textContent())?.trim();
      await chips.nth(index).click();
      const shown = await page.getByText(/^\d+ vendors?$/).first().textContent();
      expect(Number(shown!.match(/\d+/)![0]), `vendor kind "${label}" is a dead filter`).toBeGreaterThan(0);
    }
  });
});

test("/enforcement distinguishes an empty filter from an empty corpus", async ({ page }) => {
  await page.goto("/enforcement?filter=severe");
  const body = await page.locator("body").innerText();
  const corpus = Number(body.match(/Everything on record\s*(\d+)/)?.[1] ?? "-1");
  expect(corpus, "could not read the corpus count off the page").toBeGreaterThanOrEqual(0);

  if (corpus === 0) {
    // Nothing has been ingested. Say that, and do NOT also blame the filter — that sentence sends
    // the reader hunting for a filter to clear when none is hiding anything.
    expect(body).toContain("No enforcement records ingested yet.");
    expect(body).not.toContain("Nothing on record for this filter.");
  } else {
    // Records exist and this filter matched none of them. The page used to claim the CORPUS was
    // empty here, directly under a line saying the opposite.
    expect(body).not.toContain("No enforcement records ingested yet.");
  }
});
