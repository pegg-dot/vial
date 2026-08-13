import { describe, expect, it } from "vitest";
import { relativeTime } from "@/lib/format";

// listings.last_checked is a stored literal that read "just now" on all 537 live listings while the
// vendor page beside them said "Updated 2026-08-05". This is what replaces it.
describe("relativeTime", () => {
  const now = new Date("2026-08-13T00:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("reports recent observations as just now", () => {
    expect(relativeTime(ago(10_000), now)).toBe("just now");
  });

  it("scales through minutes, hours, days, months and years", () => {
    expect(relativeTime(ago(5 * 60_000), now)).toBe("5 minutes ago");
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe("3 hours ago");
    expect(relativeTime(ago(8 * 86_400_000), now)).toBe("8 days ago");
    expect(relativeTime(ago(70 * 86_400_000), now)).toBe("2 months ago");
    expect(relativeTime(ago(800 * 86_400_000), now)).toBe("2 years ago");
  });

  it("uses the singular for exactly one unit", () => {
    expect(relativeTime(ago(1 * 3_600_000), now)).toBe("1 hour ago");
    expect(relativeTime(ago(1 * 86_400_000), now)).toBe("1 day ago");
  });

  // The caller falls back to the stored literal on null, so a bad value must not render "NaN ago".
  it("returns null for missing or unparseable input rather than guessing", () => {
    expect(relativeTime(null, now)).toBeNull();
    expect(relativeTime(undefined, now)).toBeNull();
    expect(relativeTime("not a date", now)).toBeNull();
  });

  it("never reports a future observation as negative time", () => {
    expect(relativeTime(new Date(now.getTime() + 60_000), now)).toBe("just now");
  });
});
