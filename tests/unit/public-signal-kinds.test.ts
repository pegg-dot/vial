import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PUBLIC_SIGNAL_KINDS,
  PUBLIC_SIGNAL_TYPES,
  publicSignalLabel,
  publicSignalWhereSql,
} from "@/server/intelligence/signal-kinds";

// /signals carried a thirteen-entry label map. The query behind it restricted `signal_type` to
// seven values. Six labels — batch-document-gap, vendor-onboarding, listing-evidence-refresh,
// source-health, new-batch-evidence, listing-price-outlier — were therefore unreachable: the
// scanner and the cascade wrote those signals, countPublicSignals refused to count them, and the
// page could not have rendered one if it tried. Nothing failed. The feed was simply smaller than
// the database, and said nothing about it.
//
// A comment cannot hold two lists in agreement, so there is now one list and the query is derived
// from it. These tests fail if that stops being true, and — the case that actually matters — if a
// new signal type is emitted by code without ever being given a label or a way to be read.

const serverDir = fileURLToPath(new URL("../../src/server", import.meta.url));

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? tsFiles(`${dir}/${entry.name}`)
      : entry.name.endsWith(".ts")
        ? [`${dir}/${entry.name}`]
        : [],
  );
}

/** Every signal type the server actually writes, read out of the source that writes it. */
function emittedSignalTypes(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of tsFiles(serverDir)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/signalType:\s*"([a-z][a-z0-9-]*)"/g)) {
      const where = found.get(match[1]) ?? [];
      where.push(file.slice(serverDir.length + 1));
      found.set(match[1], where);
    }
  }
  return found;
}

/** The IN-list the public query really carries, parsed back out of the clause it builds. */
function typesInWhereClause(): string[] {
  const clause = publicSignalWhereSql("os");
  const list = /signal_type IN \(([^)]*)\)/.exec(clause);
  expect(list, "the public WHERE clause no longer restricts signal_type at all").not.toBeNull();
  return list![1].split(",").map((value) => value.trim().replace(/^'|'$/g, ""));
}

describe("the public signal query and the labels a reader sees", () => {
  // Positive control: if the scan below ever stops finding the emitters, every other assertion in
  // this file passes vacuously.
  it("finds the signal types the server writes", () => {
    const emitted = emittedSignalTypes();
    expect(emitted.size, "the emitter scan found nothing — the regex has stopped matching").toBeGreaterThanOrEqual(13);
    expect([...emitted.keys()]).toContain("listing-price-outlier");
  });

  it("asks the database for exactly the kinds it can name", () => {
    expect(typesInWhereClause().slice().sort()).toEqual(PUBLIC_SIGNAL_TYPES.slice().sort());
  });

  // The original defect, stated as a rule: a signal that code can produce must be one a reader can
  // be shown and can read. Both halves, or it is written for nobody.
  it("can show and can name every signal type the server writes", () => {
    for (const [type, files] of emittedSignalTypes()) {
      expect(
        PUBLIC_SIGNAL_TYPES,
        `${type} is written by ${files.join(", ")} but is not in PUBLIC_SIGNAL_KINDS, so /signals will never select it`,
      ).toContain(type);
      expect(
        publicSignalLabel(type),
        `${type} has no human label, so /signals would print the machine key`,
      ).not.toBe(type.replaceAll("-", " "));
    }
  });

  it("keeps one copy of the list — the page and the repository must not carry their own", () => {
    const page = readFileSync(new URL("../../src/app/signals/page.tsx", import.meta.url), "utf8");
    const repository = readFileSync(new URL("../../src/server/intelligence/repository.ts", import.meta.url), "utf8");
    expect(page, "the signals page has its own label map again").toContain("publicSignalLabel");
    expect(page).not.toMatch(/SIGNAL_KIND\s*:\s*Record/);
    expect(
      repository,
      "the repository restates the signal_type list instead of deriving it from the label map",
    ).not.toMatch(/signal_type IN \('/);
    expect(repository).toContain("publicSignalWhereSql");
  });

  it("labels are real words, and an unknown type still reads as words", () => {
    for (const [type, label] of Object.entries(PUBLIC_SIGNAL_KINDS)) {
      expect(label.trim().length, `${type} has an empty label`).toBeGreaterThan(0);
      expect(label).not.toBe(type);
    }
    expect(publicSignalLabel("some-future-kind")).toBe("some future kind");
  });

  // The count and the list must be the same population, or the page's "active public signals"
  // number describes a different feed than the cards under it.
  it("uses the same clause for the list and the count", () => {
    const repository = readFileSync(new URL("../../src/server/intelligence/repository.ts", import.meta.url), "utf8");
    expect(repository.match(/PUBLIC_SIGNAL_WHERE/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});
