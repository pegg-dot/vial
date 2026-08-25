import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Every admin page must be reachable by clicking.
//
// The chrome carried three links from when Capture, Review and Published were the only admin
// pages. Sources and Traces were built later and never added, so the only way to reach the surface
// that shows what the collectors are doing was to type its URL. Nothing failed — the pages worked
// perfectly, and were simply unreachable.
//
// This walks the filesystem rather than restating a list, so a new admin page that nobody links to
// turns this red instead of quietly becoming another island.

const adminDir = fileURLToPath(new URL("../../src/app/admin", import.meta.url));
const nav = readFileSync(new URL("../../src/components/admin/admin-nav.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../../src/components/admin/admin-shell.tsx", import.meta.url), "utf8");

/** Admin pages a person navigates to. Excludes login (pre-auth) and dynamic routes. */
function adminPages(): string[] {
  return readdirSync(adminDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "login" && !e.name.startsWith("["))
    .filter((e) => existsSync(`${adminDir}/${e.name}/page.tsx`))
    .map((e) => `/admin/${e.name}`);
}

describe("every admin page is reachable from the chrome", () => {
  it("finds admin pages to check", () => {
    expect(adminPages().length).toBeGreaterThanOrEqual(5);
  });

  it.each(adminPages().map((p) => [p]))("%s is linked in the nav", (path) => {
    expect(nav).toContain(`"${path}"`);
  });

  // The nav is useless if the shell does not render it, and the shell is useless if the layout
  // does not wrap every page in it.
  it("is rendered by the shell, which wraps every admin page", () => {
    expect(shell).toContain("<AdminNav />");
    const layout = readFileSync(new URL("../../src/app/admin/layout.tsx", import.meta.url), "utf8");
    expect(layout).toContain("AdminShell");
  });

  // It was `hidden sm:flex`, so on a phone there was no way to move between admin pages at all.
  it("is not hidden on small screens", () => {
    expect(nav).not.toMatch(/className="[^"]*\bhidden\b[^"]*sm:flex/);
  });

  // Colour alone must not be the only signal of which page you are on.
  it("marks the current page for assistive tech, not just visually", () => {
    expect(nav).toContain('aria-current');
    expect(nav).toContain('aria-label');
  });

  // A prefix match would light up the wrong step on nested routes.
  it("matches the current page exactly rather than by prefix", () => {
    expect(nav).toContain("pathname === step.href");
    expect(nav).not.toContain("pathname.startsWith(step.href)");
  });
});
