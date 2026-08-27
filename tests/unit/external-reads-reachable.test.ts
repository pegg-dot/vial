import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A read nobody calls is a page nobody can see.
//
// `getVendorNews` was written, exported, indexed for, and called by nothing. News items carrying a
// `vendor_slug` were reachable only through the site-wide /news feed, where a reader standing on a
// vendor page had to already know to go and search for the company. `listAllOffers` was the same
// shape: an exported cross-vendor read with a comment claiming it was "for the news feed", which
// the news feed did not call. Neither ever failed a test, because a function nothing calls cannot
// fail one.
//
// So: every READ this module exports must have a caller in the application. Writers are excluded —
// collectors call those, and a collector that stops writing is a different (and loudly monitored)
// failure. Tests are not counted as callers on purpose: a read exercised only by its own test is
// exactly the thing this guard exists to catch.

const srcDir = fileURLToPath(new URL("../../src", import.meta.url));
const MODULE = "src/server/external/repository.ts";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(`${dir}/${entry.name}`)
      : /\.tsx?$/.test(entry.name)
        ? [`${dir}/${entry.name}`]
        : [],
  );
}

/** Exported reads — the `get...` / `list...` functions a surface would render. */
function exportedReads(): string[] {
  const source = readFileSync(fileURLToPath(new URL(`../../${MODULE}`, import.meta.url)), "utf8");
  return [...source.matchAll(/export async function ((?:get|list)[A-Za-z0-9_]*)\s*\(/g)].map((match) => match[1]);
}

function callersOf(name: string): string[] {
  const pattern = new RegExp(`\\b${name}\\s*\\(`);
  return sourceFiles(srcDir)
    .filter((file) => !file.endsWith("external/repository.ts"))
    .filter((file) => pattern.test(readFileSync(file, "utf8")))
    .map((file) => file.slice(srcDir.length + 1));
}

describe("every exported read on the external-data repository reaches a surface", () => {
  // Positive control: if the scan stops finding functions, every case below passes vacuously.
  it("finds the reads to check", () => {
    const reads = exportedReads();
    expect(reads.length, "the export scan found nothing — the regex has stopped matching").toBeGreaterThanOrEqual(5);
    expect(reads).toContain("getVendorNews");
  });

  it.each(exportedReads().map((name) => [name]))("%s is called by something a reader can reach", (name) => {
    expect(
      callersOf(name),
      `${MODULE} exports ${name} and nothing under src/ calls it. Wire it to the surface it belongs on, or delete it — a read with no caller is a query that never runs and a page that never exists.`,
    ).not.toHaveLength(0);
  });
});
