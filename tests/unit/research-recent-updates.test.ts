import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import {
  RECENT_UPDATE_ENTRIES, formatUpdateDate, isIsoCalendarDay, recentlyUpdated, type RecentUpdate,
} from "@/lib/research-recent-updates";
import { PEXIGANAN_REVIEW_DATE } from "@/lib/pexiganan-evidence-network";
import { FILE_GRADE_CURATION_DATE } from "@/lib/research-file-grade";
import { MATERIAL_REVIEW_DATE } from "@/lib/research-materials";
import { MAGAININ_PEXIGANAN_CASE } from "@/lib/research-guided-case";

const row = (id: string, date: string): RecentUpdate => ({ id, title: id, date, href: "/intelligence/" + id, note: "n" });

describe("recently updated strip", () => {
  it("takes every date from the committed review constants, not a copy", () => {
    const byId = Object.fromEntries(RECENT_UPDATE_ENTRIES.map(e => [e.id, e.date]));
    expect(byId["pexiganan-passport"]).toBe(PEXIGANAN_REVIEW_DATE);
    expect(byId["magainin-pexiganan-case"]).toBe(MAGAININ_PEXIGANAN_CASE.updatedAt);
    expect(byId["source-file-coverage"]).toBe(FILE_GRADE_CURATION_DATE);
    expect(byId["material-records"]).toBe(MATERIAL_REVIEW_DATE);
  });

  it("only links to routes that exist and never to anything outbound", () => {
    for (const e of RECENT_UPDATE_ENTRIES) {
      expect(e.href.startsWith("/intelligence/")).toBe(true);
      const dir = e.href.split("?")[0]!.replace(/^\//, "").split("/").slice(0, 2).join("/");
      expect(existsSync("src/app/" + dir)).toBe(true);
    }
  });

  it("uses research wording only: no selling, price or availability language", () => {
    const text = RECENT_UPDATE_ENTRIES.map(e => e.title + " " + e.note).join(" ").toLowerCase();
    for (const word of ["buy", "shop", "price", "cart", "order", "available from", "in stock", "discount", "supplier", "vendor"]) {
      expect(text).not.toContain(word);
    }
  });

  it("sorts newest first with a stable id tiebreak", () => {
    const out = recentlyUpdated([row("b", "2026-10-01"), row("a", "2026-10-19"), row("c", "2026-10-19")], { today: "2026-10-21" });
    expect(out.map(e => e.id)).toEqual(["a", "c", "b"]);
  });

  it("drops malformed, impossible and future dates instead of guessing", () => {
    const out = recentlyUpdated(
      [row("ok", "2026-10-19"), row("fmt", "10/19/2026"), row("feb30", "2026-02-30"), row("future", "2026-10-22"), row("time", "2026-10-19T00:00:00Z")],
      { today: "2026-10-21" },
    );
    expect(out.map(e => e.id)).toEqual(["ok"]);
  });

  it("honours the limit and returns nothing for an empty list", () => {
    const many = [row("a", "2026-10-01"), row("b", "2026-10-02"), row("c", "2026-10-03")];
    expect(recentlyUpdated(many, { limit: 2, today: "2026-10-21" }).map(e => e.id)).toEqual(["c", "b"]);
    expect(recentlyUpdated([], { today: "2026-10-21" })).toEqual([]);
    expect(recentlyUpdated(many, { limit: 0, today: "2026-10-21" })).toEqual([]);
  });

  it("validates calendar days exactly", () => {
    expect(isIsoCalendarDay("2024-02-29")).toBe(true);
    expect(isIsoCalendarDay("2026-02-29")).toBe(false);
    expect(isIsoCalendarDay("2026-13-01")).toBe(false);
    expect(isIsoCalendarDay("2026-1-1")).toBe(false);
  });

  it("formats in UTC so a viewer's timezone cannot shift the day", () => {
    expect(formatUpdateDate("2026-10-19")).toBe("Oct 19, 2026");
    expect(formatUpdateDate("2026-01-01")).toBe("Jan 1, 2026");
  });

  it("shows entries with the shipped data today", () => {
    expect(recentlyUpdated(RECENT_UPDATE_ENTRIES, { today: "2026-10-21" }).length).toBe(RECENT_UPDATE_ENTRIES.length);
  });
});
