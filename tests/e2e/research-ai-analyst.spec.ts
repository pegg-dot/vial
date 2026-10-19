import { expect, test } from "@playwright/test";

test.describe("Local research AI analyst", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Evidence-only preview");

  test("never pretends model capability is live when no connection has been authorized", async ({ page, request }) => {
    test.skip(process.env.VIALGRADE_RESEARCH_AI_ENABLED === "true", "Offline-mode case");
    const response = await page.goto("/intelligence/desk");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "AI evidence analyst" })).toBeVisible();
    await expect(page.getByText("Model not connected", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Analyze this research question" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Download source briefing" })).toBeVisible();
    const denial = await request.post("/api/research/analyst", {
      data: { topicId: "publication-matching", audience: "researcher", question: "", consent: true },
      headers: { origin: "http://localhost:" + (process.env.VIAL_E2E_PORT ?? "3000") },
    });
    expect(denial.status()).toBe(503);
    expect((await denial.json()).code).toBe("model_not_connected");
    expect((await request.post("/api/v1/commerce/checkout", { data: {} })).status()).toBe(410);
  });

  test("accepts an exact loopback browser origin without allowing an unrelated website", async ({ request }) => {
    test.skip(process.env.VIALGRADE_RESEARCH_AI_ENABLED === "true", "Offline-only origin gate check");
    const local = "http://127.0.0.1:" + (process.env.VIAL_E2E_PORT ?? "3000");
    const body = { topicId: "publication-matching", audience: "researcher", question: "", consent: true };
    const same = await request.post(local + "/api/research/analyst", {
      headers: { origin: local },
      data: body,
    });
    expect(same.status()).toBe(503);
    expect((await same.json()).code).toBe("model_not_connected");
    const other = await request.post(local + "/api/research/analyst", {
      headers: { origin: "https://elsewhere.invalid" },
      data: body,
    });
    expect(other.status()).toBe(403);
  });

  test("requires consent and shows verified source URLs beside clearly provisional model text", async ({ page }) => {
    test.skip(process.env.VIALGRADE_RESEARCH_AI_ENABLED !== "true", "Opt-in mock UI test only");
    // The browser intercepts the model endpoint. NO live key, vendor call, or credit is used.
    let requests = 0;
    await page.route("**/api/research/analyst", async route => {
      requests += 1;
      const payload = route.request().postDataJSON();
      expect(route.request().headers()["x-vialgrade-research-ai-token"])
        .toMatch(/^\d{10}\.[0-9a-f]{24}\.[0-9a-f]{64}$/);
      expect(payload.consent).toBe(true);
      expect(payload.topicId).toBe("publication-matching");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "model-proposed-not-expert-reviewed", subject: "pexiganan", topicId: "publication-matching",
          audience: "researcher", model: "mock-test-only", sourceSnapshot: "2026-10-19",
          scope: "limited",
          modelSummary: "The registered study connection is not proven by the bibliographic label.",
          findings: [{
            claimId: "publication-ambiguity",
            heading: "A cited RCT article is not automatically matched to one NCT",
            originalObservation: "The registry cites the article as DERIVED.",
            originalLimit: "The record does not uniquely link this publication to one trial.",
            originalStatus: "needs-interpretation",
            aiInterpretation: "A clinician-scientist should compare primary manuscript methods.",
            citations: [{
              id: "trial-rct-article", identifier: "PMID 18990064",
              url: "https://pubmed.ncbi.nlm.nih.gov/18990064/",
              kind: "clinical-paper", publisher: "NIH PubMed", limitation: "Publication match unverified",
            }],
          }],
          potentialConflicts: [],
          gaps: [{ claimId: "publication-ambiguity", originalLimit: "No exact link", aiNote: "Reconcile protocol population and methods." }],
          nextSources: [{ id: "trial-rct-article", identifier: "PMID 18990064", url: "https://pubmed.ncbi.nlm.nih.gov/18990064/", kind: "clinical-paper", publisher: "NIH PubMed", limitation: "Match unverified" }],
          evidenceToolCalls: 1,
          boundaries: ["AI interpretation is NOT scientifically or clinically verified."],
        }),
      });
    });
    await page.goto("/intelligence/desk");
    await expect(page.getByText("Gateway configured", { exact: true })).toBeVisible();
    // The server can issue a narrow signed capability, but never the Gateway API key itself.
    expect(await page.content()).not.toContain("example-mock-key-never-valid");
    await expect(page.getByRole("button", { name: "Analyze this research question" })).toBeDisabled();
    expect(requests).toBe(0);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Analyze this research question" }).click();
    await expect(page.getByText("AI draft · human review required")).toBeVisible();
    await expect(page.getByText("A clinician-scientist should compare primary manuscript methods.")).toBeVisible();
    await expect(page.getByRole("link", { name: /PMID 18990064/ }).first())
      .toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/18990064/");
    expect(requests).toBe(1);
    // Previously displayed AI content must be cleared when the research topic changes.
    await page.getByRole("button", { name: /Clinical program/ }).click();
    await expect(page.getByText("AI draft · human review required")).toHaveCount(0);
  });

  test("keeps AI panel inside the phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/intelligence/desk");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  });
});
