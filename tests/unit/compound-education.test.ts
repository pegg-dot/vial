import { describe, expect, it } from "vitest";
import { COMPOUND_EDUCATION, GOAL_TAGS, educationFor, goalLabel } from "@/lib/compound-education";
import { classifyPost } from "@/server/ingest/reddit";

describe("compound education data", () => {
  it("resolves known compounds and returns undefined for unknown", () => {
    expect(educationFor("bpc-157")?.goals).toContain("recovery");
    expect(educationFor("not-a-real-compound")).toBeUndefined();
  });

  it("labels goals and falls back to the raw key", () => {
    expect(goalLabel("recovery")).toBe("Recovery & healing");
    expect(goalLabel("mystery")).toBe("mystery");
  });

  it("every goal tag used is defined (no dangling category chips)", () => {
    for (const [slug, edu] of Object.entries(COMPOUND_EDUCATION)) {
      for (const g of edu.goals) expect(GOAL_TAGS[g], `${slug} uses undefined goal ${g}`).toBeTruthy();
    }
  });

  it("every stacked compound resolves to a real compound (no dead bundle links)", () => {
    for (const [slug, edu] of Object.entries(COMPOUND_EDUCATION)) {
      for (const s of edu.stackedWith ?? []) {
        expect(COMPOUND_EDUCATION[s], `${slug} stacks with unknown ${s}`).toBeTruthy();
        expect(s, `${slug} stacks with itself`).not.toBe(slug);
      }
    }
  });
});

describe("reddit mention classification", () => {
  it("flags scam / quality complaints as negative", () => {
    expect(classifyPost({ title: "Vendor X is a scam, never arrived", url: "", ups: 3, body: "" })).toBe("negative");
    expect(classifyPost({ title: "warning", url: "", ups: 0, body: "these were underdosed, failed test" })).toBe("negative");
  });
  it("flags vouches as positive", () => {
    expect(classifyPost({ title: "Vendor X is G2G, third-party tested", url: "", ups: 5, body: "" })).toBe("positive");
  });
  it("leaves ambiguous posts neutral", () => {
    expect(classifyPost({ title: "Anyone tried Vendor X for BPC-157?", url: "", ups: 1, body: "" })).toBe("neutral");
  });
});
