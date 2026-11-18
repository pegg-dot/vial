import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AdminColumns } from "@/components/admin/admin-columns";
import { SignupTable, maskEmail } from "@/components/admin/signup-table";
import { fillSignupDays, signupDay, signupState, type SignupRow } from "@/server/digest/signup-overview";
import { daysBetween, fillWeeks } from "@/server/admin/catalog-insights";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("signup days", () => {
  it("puts an instant on its Eastern calendar day, not its UTC one", () => {
    expect(signupDay(new Date("2026-11-17T03:30:00Z"))).toBe("2026-11-16");
    expect(signupDay(new Date("2026-11-17T05:30:00Z"))).toBe("2026-11-17");
    // Daylight time: midnight Eastern is 04:00 UTC.
    expect(signupDay(new Date("2026-07-04T03:59:00Z"))).toBe("2026-07-03");
    expect(signupDay(new Date("2026-07-04T04:00:00Z"))).toBe("2026-07-04");
  });

  it("returns the days asked for, oldest first, ending today, with zero where nobody signed up", () => {
    const days = fillSignupDays(new Map([["2026-11-17", 2], ["2026-11-15", 5], ["2026-10-01", 9]]), new Date("2026-11-17T18:00:00Z"), 4);
    expect(days).toEqual([{ day: "2026-11-14", count: 0 }, { day: "2026-11-15", count: 5 }, { day: "2026-11-16", count: 0 }, { day: "2026-11-17", count: 2 }]);
  });

  it("crosses a month and a clock change without skipping or repeating a day", () => {
    const days = fillSignupDays(new Map(), new Date("2026-11-03T15:00:00Z"), 30).map((d) => d.day);
    expect(days).toHaveLength(30);
    expect(new Set(days).size).toBe(30);
    expect(days[0]).toBe("2026-10-05");
    expect(days.at(-1)).toBe("2026-11-03");
    expect(days).toContain("2026-11-01");
    expect(days).toContain("2026-10-31");
  });

  it("names the three states a row can be in", () => {
    expect(signupState({ status: "active", confirm_sent_at: "2026-11-01" })).toBe("confirmed");
    expect(signupState({ status: "active", confirm_sent_at: null })).toBe("confirmed");
    expect(signupState({ status: "pending", confirm_sent_at: "2026-11-01" })).toBe("confirmation-sent");
    expect(signupState({ status: "pending", confirm_sent_at: null })).toBe("waiting");
  });
});

describe("price-read weeks", () => {
  it("returns consecutive Mondays ending with this week, zero-filled", () => {
    // 2026-11-17 is a Tuesday; its week starts Monday the 16th.
    expect(fillWeeks(new Map([["2026-11-16", 7], ["2026-11-02", 40]]), "2026-11-17", 4)).toEqual([
      { week: "2026-10-26", listings: 0 }, { week: "2026-11-02", listings: 40 }, { week: "2026-11-09", listings: 0 }, { week: "2026-11-16", listings: 7 },
    ]);
  });

  it("treats a Monday and a Sunday as the start and end of the same week", () => {
    expect(fillWeeks(new Map(), "2026-11-16", 1)).toEqual([{ week: "2026-11-16", listings: 0 }]);
    expect(fillWeeks(new Map(), "2026-11-22", 1)).toEqual([{ week: "2026-11-16", listings: 0 }]);
    expect(fillWeeks(new Map(), "2026-11-23", 1)).toEqual([{ week: "2026-11-23", listings: 0 }]);
  });

  it("counts whole days between two dates", () => {
    expect(daysBetween("2026-11-17", "2026-11-17")).toBe(0);
    expect(daysBetween("2026-10-17", "2026-11-17")).toBe(31);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
  });
});

describe("AdminColumns", () => {
  const points = [{ label: "Nov 14", value: 0 }, { label: "Nov 15", value: 5 }, { label: "Nov 16", value: 1 }, { label: "Nov 17", value: 2 }];
  const render = (data = points) => renderToStaticMarkup(createElement(AdminColumns, { points: data, title: "Signups per day", unit: "signup", emptyText: "No signups yet.", startLabel: "Nov 14", endLabel: "Nov 17" }));

  it("draws one slot per period and a column only where there is something to count", () => {
    const html = render();
    expect([...html.matchAll(/tabindex="0"/g)]).toHaveLength(4);
    expect([...html.matchAll(/bg-\[#2b31d8\]/g)]).toHaveLength(3);
    expect(html).toContain("height:100%");
    expect(html).toContain("height:20%");
    expect(html).toContain("height:40%");
  });

  it("gives every period its own value on hover or focus, and labels only the peak", () => {
    const html = render();
    expect([...html.matchAll(/role="tooltip"/g)]).toHaveLength(4);
    const body = text(html);
    expect(body).toContain("5 signups · Nov 15");
    expect(body).toContain("1 signup · Nov 16");
    expect(body).toContain("0 signups · Nov 14");
    expect([...html.matchAll(/group-hover:hidden/g)]).toHaveLength(1);
  });

  it("describes itself to a screen reader and carries every value in a table", () => {
    const html = render();
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Signups per day: 8 signups in total, peak 5 signups (Nov 15)."');
    expect([...html.matchAll(/<tr>/g)]).toHaveLength(5);
    expect(text(html)).toContain("View as a table");
  });

  it("says so in words instead of drawing an empty chart", () => {
    const html = render(points.map((p) => ({ ...p, value: 0 })));
    expect(text(html).trim()).toBe("No signups yet.");
    expect(html).not.toContain("role=\"img\"");
  });
});

describe("SignupTable", () => {
  const rows: SignupRow[] = [
    { id: "a", email: "jane.doe@example.org", state: "confirmed", signedUpAt: "2026-11-16T15:00:00.000Z", confirmedAt: "2026-11-16T15:05:00.000Z", lastEmailedAt: null },
    { id: "b", email: "sam@example.org", state: "waiting", signedUpAt: "2026-11-17T15:00:00.000Z", confirmedAt: null, lastEmailedAt: null },
    { id: "c", email: "lee@example.org", state: "confirmation-sent", signedUpAt: "2026-11-15T15:00:00.000Z", confirmedAt: null, lastEmailedAt: null },
  ];
  const render = (showAddresses: boolean, compact = false, data = rows) => renderToStaticMarkup(createElement(SignupTable, { rows: data, showAddresses, compact }));

  it("lists each address with its state and when it signed up", () => {
    const body = text(render(true));
    for (const expected of ["jane.doe@example.org", "sam@example.org", "lee@example.org", "Confirmed", "Waiting", "Link sent", "Nov 16, 2026", "never"]) expect(body).toContain(expected);
  });

  it("masks every address for staff whose role may not read personal data", () => {
    const html = render(false);
    for (const row of rows) expect(html).not.toContain(row.email);
    expect(html).not.toContain("jane.doe");
    expect(text(html)).toContain("j•••@example.org");
    expect(maskEmail("a@b.co")).toBe("a•••@b.co");
    expect(maskEmail("not-an-address")).toBe("•••");
    expect(maskEmail("@example.org")).toBe("•••");
  });

  it("the compact version keeps address, state and day, and drops the rest", () => {
    const html = render(true, true);
    expect([...html.matchAll(/<th /g)]).toHaveLength(3);
    expect(text(html)).not.toContain("Last emailed");
    expect([...render(true).matchAll(/<th /g)]).toHaveLength(5);
  });

  it("says nobody has signed up rather than drawing an empty table", () => {
    const html = render(true, false, []);
    expect(html).not.toContain("<table");
    expect(text(html)).toContain("Nobody is on the list yet");
  });
});

describe("the admin overview page", () => {
  const page = readFileSync(new URL("../../src/app/admin/page.tsx", import.meta.url), "utf8");
  const order = ['id="signups"', 'id="reach"', 'id="catalog"', 'id="collection"', 'id="accounts"', 'id="historical"'];

  it("has every section its jump list names, in the order the owner reads them", () => {
    const at = order.map((marker) => page.indexOf(`<SectionHead ${marker}`));
    for (const [i, index] of at.entries()) expect(index, order[i]).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    for (const marker of order) expect(page).toContain(`{ id: "${marker.slice(4, -1)}"`);
  });

  it("shows addresses only through the permission check, never unconditionally", () => {
    expect(page).toContain('principalHasPermission(principal, "privacy:read")');
    expect(page).toContain("showAddresses={mayReadAddresses}");
    expect(page).not.toMatch(/showAddresses(?:=\{true\})?[\s/>]/);
    const signupsPage = readFileSync(new URL("../../src/app/admin/signups/page.tsx", import.meta.url), "utf8");
    expect(signupsPage).toContain('principalHasPermission(principal, "privacy:read")');
    expect(signupsPage).toContain('accountType !== "staff"');
  });

  it("never joins the email list to page views, accounts or clicks", () => {
    const overview = readFileSync(new URL("../../src/server/digest/signup-overview.ts", import.meta.url), "utf8");
    const sql = [...overview.matchAll(/`([^`]*)`/g)].map((m) => m[1]).join("\n");
    expect(sql).toContain("digest_subscribers");
    for (const table of ["page_views", "auth_users", "auth_sessions", "outbound_clicks", "visitor_hash", "ip_hash", " JOIN "]) expect(sql).not.toContain(table);
  });

  it("states that reader counting is off instead of presenting a frozen number as live", () => {
    expect(page).toContain("Reader counting is switched off");
    expect(page).not.toContain(">Reader traffic</h1>");
  });
});
