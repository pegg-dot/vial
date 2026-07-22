import { describe, expect, it } from "vitest";
import { selectNewEntries } from "@/server/ingest/janoshik-discovery";
import type { JanoshikEntry } from "@/server/ingest/lab-tests";

const entry = (testId: string, key = `KEY${testId}00000`): JanoshikEntry => ({
  testId,
  sampleName: "BPC-157 5mg",
  manufacturer: "acme.com",
  client: "",
  verifyUrl: `https://verify.janoshik.com/tests/${testId}-BPC157_${key}`,
  verifyKey: key,
});

describe("selectNewEntries", () => {
  it("keeps only entries whose verify_url is not already stored", () => {
    const known = new Set([entry("100").verifyUrl]);
    const picked = selectNewEntries([entry("100"), entry("101"), entry("102")], known);
    expect(picked.map((e) => e.testId)).toEqual(["101", "102"]);
  });

  it("dedupes repeated verify_urls within a single feed", () => {
    const picked = selectNewEntries([entry("100"), entry("100"), entry("101")], new Set());
    expect(picked.map((e) => e.testId)).toEqual(["100", "101"]);
  });

  it("drops entries without a verify url instead of ingesting junk", () => {
    const broken = { ...entry("103"), verifyUrl: "" };
    expect(selectNewEntries([broken], new Set())).toEqual([]);
  });

  it("returns everything when nothing is stored yet", () => {
    expect(selectNewEntries([entry("1"), entry("2")], new Set())).toHaveLength(2);
  });
});
