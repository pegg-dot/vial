import { describe, expect, it } from "vitest";
import { PLAIN_ENGLISH } from "@/lib/compound-plain-english";
import { COMPOUND_DEPTH, depthFor } from "@/lib/compound-depth";

// The plain-English layer exists so a first-time visitor reads a human sentence before any
// science. These guards keep it honest: complete coverage in both directions, and actually
// plain — a line that needs a biology degree fails the jargon check.

const JARGON = /\b(agonist|antagonist|receptor|kinase|upregulat\w*|downregulat\w*|transcription|pegylat\w*|amino[- ]acids?|analog(?:ue)?s?|in[- ]vitro|angiogenesis|secretagogue|incretin|proteolysis|glycoprotein)\b/i;

describe("compound plain-english coverage", () => {
  it("every compound with depth data has a plain-english line", () => {
    for (const slug of Object.keys(COMPOUND_DEPTH)) {
      expect(PLAIN_ENGLISH[slug], `${slug} has no plain-english translation`).toBeTruthy();
    }
  });

  it("every plain-english line maps to a real compound (no orphans)", () => {
    for (const slug of Object.keys(PLAIN_ENGLISH)) {
      expect(COMPOUND_DEPTH[slug], `plain-english orphan: ${slug}`).toBeTruthy();
    }
  });

  it("lines are real sentences, not stubs or essays", () => {
    for (const [slug, line] of Object.entries(PLAIN_ENGLISH)) {
      expect(line.length, `${slug} too short to explain anything`).toBeGreaterThanOrEqual(40);
      expect(line.length, `${slug} too long for a plain-english lead`).toBeLessThanOrEqual(360);
      expect(line.trim(), `${slug} has leading/trailing whitespace`).toBe(line);
    }
  });

  it("lines contain no untranslated jargon", () => {
    for (const [slug, line] of Object.entries(PLAIN_ENGLISH)) {
      const m = line.match(JARGON);
      expect(m, `${slug} uses jargon "${m?.[0]}" — translate it`).toBeNull();
    }
  });

  it("does not just repeat the scientific mechanism", () => {
    for (const [slug, line] of Object.entries(PLAIN_ENGLISH)) {
      expect(line, `${slug} plain-english line duplicates the mechanism`).not.toBe(COMPOUND_DEPTH[slug]?.mechanism);
    }
  });

  it("depthFor merges the plain-english line in", () => {
    expect(depthFor("bpc-157")?.plainEnglish).toContain("stomach");
    expect(depthFor("not-a-real-compound")).toBeUndefined();
  });
});
