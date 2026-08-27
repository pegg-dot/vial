import { describe, expect, it } from "vitest";
import { isUniqueViolation, PG_UNIQUE_VIOLATION } from "@/server/postgres-error";
import {
  alertModeFailureMessage,
  serverFailureMessage,
  TRANSPORT_FAILURE,
  withRowFlag,
  withRowMessage,
} from "@/lib/saved-search-feedback";

/** What `pg` and PGlite actually hand back for a UNIQUE(user_id, name) collision. */
function uniqueViolation() {
  return Object.assign(new Error(`duplicate key value violates unique constraint "saved_searches_user_id_name_key"`), {
    code: PG_UNIQUE_VIOLATION,
    severity: "ERROR",
    table: "saved_searches",
    constraint: "saved_searches_user_id_name_key",
    detail: "Key (user_id, name)=(user:customer:nora, Weekly BPC) already exists.",
  });
}

describe("classifying a duplicate-name conflict", () => {
  it("recognizes the SQLSTATE both drivers report", () => {
    expect(isUniqueViolation(uniqueViolation())).toBe(true);
    expect(PG_UNIQUE_VIOLATION).toBe("23505");
  });

  it("finds the violation through a wrapper that re-threw it as a cause", () => {
    const wrapped = new Error("Could not save the search", { cause: uniqueViolation() });
    expect(isUniqueViolation(wrapped)).toBe(true);
    expect(isUniqueViolation(new Error("outer", { cause: new Error("middle", { cause: uniqueViolation() }) }))).toBe(true);
  });

  it("falls back to the sentence Postgres writes when the code was lost in transit", () => {
    // A serialized error that crossed a worker or RPC boundary keeps `message` and loses the rest.
    expect(isUniqueViolation({ message: `duplicate key value violates unique constraint "saved_searches_user_id_name_key"` })).toBe(true);
  });

  /**
   * The reason this predicate exists. It used to be
   * `String(error).toLowerCase().includes("unique")`, so every one of these answered the caller
   * `409 "A saved search already uses that name"` for a request whose name was never the problem —
   * and the real failure was swallowed with the 500 it should have raised.
   */
  it("does not relabel an unrelated failure that merely contains the word 'unique'", () => {
    expect(isUniqueViolation(new Error("no unique extractor selected for this vendor"))).toBe(false);
    expect(isUniqueViolation(new Error(`could not create unique index "listings_slug_idx": out of disk space`))).toBe(false);
    expect(isUniqueViolation(Object.assign(new Error("deadlock detected"), { code: "40P01", constraint: "listings_slug_unique" }))).toBe(false);
    expect(isUniqueViolation("duplicate key value violates unique constraint")).toBe(false);
    // A foreign-key violation is a different, real failure and must keep reaching the error handler.
    expect(isUniqueViolation(Object.assign(new Error("insert or update on table violates foreign key constraint"), { code: "23503" }))).toBe(false);
  });

  it("says no rather than throwing on anything that is not an error object", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
    expect(isUniqueViolation(23505)).toBe(false);
  });

  it("terminates on a cause chain that points at itself", () => {
    const looping: { message: string; cause?: unknown } = { message: "looping" };
    looping.cause = looping;
    expect(isUniqueViolation(looping)).toBe(false);
  });
});

describe("what the reader is told when a saved-search request fails", () => {
  it("prefers the server's own reason over the generic fallback", () => {
    expect(serverFailureMessage({ error: "A saved search already uses that name" }, "The search could not be saved.")).toBe("A saved search already uses that name");
  });

  it("falls back when the body carried no usable reason", () => {
    const fallback = "The search could not be saved.";
    expect(serverFailureMessage(null, fallback)).toBe(fallback);
    expect(serverFailureMessage(undefined, fallback)).toBe(fallback);
    expect(serverFailureMessage({}, fallback)).toBe(fallback);
    expect(serverFailureMessage({ error: "   " }, fallback)).toBe(fallback);
    expect(serverFailureMessage({ error: { nested: true } }, fallback)).toBe(fallback);
  });

  it("names the value the server still holds after a failed alert-mode save", () => {
    expect(alertModeFailureMessage("Alert mode could not be saved", "important")).toBe("Alert mode could not be saved — still important.");
    expect(alertModeFailureMessage(TRANSPORT_FAILURE, "off")).toContain("still off.");
  });

  it("distinguishes a request that never got a verdict from one the server refused", () => {
    expect(TRANSPORT_FAILURE).toMatch(/nothing was saved/i);
    expect(TRANSPORT_FAILURE).not.toBe(serverFailureMessage({ error: "Saved search not found" }, TRANSPORT_FAILURE));
  });
});

describe("per-row busy flags", () => {
  /**
   * The defect this replaces: one `string | null` slot. Change row A then row B quickly and A's
   * completion wrote `null`, re-enabling B's control while B's request was still open.
   */
  it("keeps one row busy while another finishes", () => {
    let flags: Record<string, boolean> = {};
    flags = withRowFlag(flags, "a", true);
    flags = withRowFlag(flags, "b", true);
    expect(flags).toEqual({ a: true, b: true });

    flags = withRowFlag(flags, "a", false);
    expect(flags.a).toBeUndefined();
    expect(flags.b).toBe(true);
  });

  it("clears only the row it was given, and tolerates clearing one that was never set", () => {
    const flags = withRowFlag({ a: true }, "b", false);
    expect(flags).toEqual({ a: true });
    expect(withRowFlag({}, "a", false)).toEqual({});
  });

  it("never mutates the record it was given", () => {
    const original = { a: true };
    withRowFlag(original, "b", true);
    withRowFlag(original, "a", false);
    expect(original).toEqual({ a: true });
  });
});

describe("per-row messages", () => {
  it("sets, replaces and clears one row without disturbing another", () => {
    let messages: Record<string, string> = {};
    messages = withRowMessage(messages, "a", "A failed");
    messages = withRowMessage(messages, "b", "B failed");
    expect(messages).toEqual({ a: "A failed", b: "B failed" });

    messages = withRowMessage(messages, "a", "A failed again");
    expect(messages.a).toBe("A failed again");

    messages = withRowMessage(messages, "a", null);
    expect(messages.a).toBeUndefined();
    expect(messages.b).toBe("B failed");
  });

  it("never mutates the record it was given", () => {
    const original = { a: "A failed" };
    withRowMessage(original, "b", "B failed");
    withRowMessage(original, "a", null);
    expect(original).toEqual({ a: "A failed" });
  });
});
