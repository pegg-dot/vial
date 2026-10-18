import { describe, expect, it } from "vitest";
import { parsePublicationResponse } from "@/server/intelligence/public-publications";

const sample = {
  results: [
    {
      id: "https://openalex.org/W123456",
      display_name: "A public scientific paper about a compound",
      publication_date: "2026-09-18",
      doi: "https://doi.org/10.1234/test-paper",
      type: "article",
      is_retracted: true,
      primary_location: { source: { display_name: "Example Journal" } },
    },
    {
      id: "https://openalex.org/W123456",
      display_name: "Duplicate paper",
    },
    {
      id: "javascript:alert(1)",
      display_name: "Script injection",
      doi: "javascript:alert(1)",
    },
    {
      id: "https://openalex.org/W666",
      display_name: "Study with malformed DOI",
      doi: "https://attacker.example/evil",
      publication_date: "invalid",
    },
  ],
};

describe("public scholarly metadata parsing", () => {
  it("accepts unique canonical records with source metadata and preserved retraction flags", () => {
    const works = parsePublicationResponse(sample);
    expect(works).toHaveLength(2);
    expect(works[0]).toEqual({
      id: "https://openalex.org/W123456",
      title: "A public scientific paper about a compound",
      published: "2026-09-18",
      doiUrl: "https://doi.org/10.1234/test-paper",
      kind: "article",
      venue: "Example Journal",
      retracted: true,
    });
    expect(works[1].doiUrl).toBeNull();
    expect(works[1].published).toBeNull();
  });

  it("does not invent a zero-research claim from malformed source data", () => {
    expect(parsePublicationResponse(null)).toEqual([]);
    expect(parsePublicationResponse({ results: "wrong-type" })).toEqual([]);
    expect(parsePublicationResponse({ results: [55, null, {}] })).toEqual([]);
  });

  it("never returns external or script URLs from untrusted metadata as record IDs", () => {
    const works = parsePublicationResponse({ results: [
      { id: "https://evil.example/W444", display_name: "bad" },
      { id: "http://openalex.org/W444", display_name: "bad" },
      { id: "https://openalex.org/W444", display_name: "good" },
    ] });
    expect(works.map(row => row.id)).toEqual(["https://openalex.org/W444"]);
  });
});
