import { describe, expect, it } from "vitest";
import { alertModeError, createSearch, deleteSearch, type Fetcher, runSearch, saveAlertMode, settleAlertModeList } from "@/lib/saved-search-actions";
import { TRANSPORT_FAILURE } from "@/lib/saved-search-feedback";

/**
 * The failure that started all of this: `fetch` REJECTS when there is no answer at all — offline,
 * DNS gone, a server replaced mid-deploy. It does not resolve with `ok:false`.
 */
const offline: Fetcher = () => Promise.reject(new TypeError("Failed to fetch"));

const json = (status: number, body: unknown): Fetcher => async () => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

/** A 502 from a proxy, a Next error page, a truncated body — anything that is not JSON. */
const notJson = (status: number): Fetcher => async () => new Response("<html>502 Bad Gateway</html>", {
  status,
  headers: { "content-type": "text/html" },
});

const savedSearch = { id: "saved-search:1", name: "Weekly BPC", query: "bpc-157", filters: {}, alertMode: "all", active: true, lastResultCount: 3, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-02T00:00:00.000Z" };

/** Captures what was actually sent, so "it resolved" is not mistaken for "it asked the right thing". */
function recorder(response: Fetcher) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: Fetcher = (input, init) => { calls.push({ url: String(input), init }); return response(input, init); };
  return { calls, fetcher };
}

describe("a saved-search request that never reaches a verdict", () => {
  /**
   * Each of these must RESOLVE. A rejection here is exactly the production defect: the caller's
   * `finally` is skipped, the busy flag is never cleared, and the control stays disabled forever.
   */
  it("resolves as a failure instead of rejecting — alert mode", async () => {
    await expect(saveAlertMode("saved-search:1", "all", offline)).resolves.toEqual({ status: "failed", message: TRANSPORT_FAILURE });
  });

  it("resolves as a failure instead of rejecting — create", async () => {
    await expect(createSearch({ name: "Weekly BPC", query: "bpc-157", alertMode: "important" }, offline)).resolves.toEqual({ status: "failed", message: TRANSPORT_FAILURE });
  });

  it("resolves as a failure instead of rejecting — delete", async () => {
    await expect(deleteSearch("saved-search:1", offline)).resolves.toEqual({ status: "failed", message: TRANSPORT_FAILURE });
  });

  it("resolves as a failure instead of rejecting — run", async () => {
    await expect(runSearch("saved-search:1", offline)).resolves.toEqual({ status: "failed", message: TRANSPORT_FAILURE });
  });

  it("carries no httpStatus, because no server ever answered", async () => {
    const result = await saveAlertMode("saved-search:1", "all", offline);
    expect(result).not.toHaveProperty("httpStatus");
  });
});

describe("changing an alert mode", () => {
  it("returns the row the server stored", async () => {
    const { calls, fetcher } = recorder(json(200, savedSearch));
    const result = await saveAlertMode("saved-search:1", "all", fetcher);
    expect(result).toEqual({ status: "saved", search: savedSearch });
    expect(calls[0]?.init?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ id: "saved-search:1", alertMode: "all" });
  });

  /**
   * The server accepted the change. A body that will not parse must not overturn that — rolling
   * back here would put a value on screen the server does NOT hold, which is the same class of lie
   * the fix is meant to end, only inverted.
   */
  it("keeps the change when the success body will not parse", async () => {
    expect(await saveAlertMode("saved-search:1", "all", notJson(200))).toEqual({ status: "saved", search: null });
    expect(await saveAlertMode("saved-search:1", "all", json(200, { unexpected: true }))).toEqual({ status: "saved", search: null });
  });

  it("reports a refusal in the server's own words", async () => {
    expect(await saveAlertMode("saved-search:1", "all", json(404, { error: "Saved search not found" }))).toEqual({
      status: "failed", message: "Saved search not found", httpStatus: 404,
    });
  });

  it("falls back to its own sentence when a refusal carried no readable reason", async () => {
    expect(await saveAlertMode("saved-search:1", "all", notJson(502))).toEqual({
      status: "failed", message: "Alert mode could not be saved", httpStatus: 502,
    });
  });
});

describe("creating a saved search", () => {
  it("returns the row the server created", async () => {
    const { calls, fetcher } = recorder(json(201, savedSearch));
    expect(await createSearch({ name: "Weekly BPC", query: "bpc-157", alertMode: "important" }, fetcher)).toEqual({ status: "created", search: savedSearch });
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ name: "Weekly BPC", query: "bpc-157", alertMode: "important", filters: {} });
  });

  /**
   * The reachable refusal. The route answers 409 for a UNIQUE(user_id, name) collision and the
   * client dropped it on the floor: the inputs kept their values, nothing appeared, and the button
   * read as broken. The reader has to be told the name is taken or they cannot fix it.
   */
  it("surfaces the 409 duplicate-name refusal", async () => {
    expect(await createSearch({ name: "Weekly BPC", query: "bpc-157", alertMode: "important" }, json(409, { error: "A saved search already uses that name" }))).toEqual({
      status: "failed", message: "A saved search already uses that name", httpStatus: 409,
    });
  });

  it("surfaces a validation refusal too", async () => {
    expect(await createSearch({ name: "x", query: "bpc-157", alertMode: "off" }, json(400, { error: "Invalid saved search" }))).toEqual({
      status: "failed", message: "Invalid saved search", httpStatus: 400,
    });
  });

  it("falls back when the refusal carried no readable reason", async () => {
    expect(await createSearch({ name: "Weekly BPC", query: "bpc-157", alertMode: "off" }, notJson(500))).toEqual({
      status: "failed", message: "The search could not be saved.", httpStatus: 500,
    });
  });
});

describe("deleting a saved search", () => {
  it("confirms the delete", async () => {
    const { calls, fetcher } = recorder(json(200, { deleted: true }));
    expect(await deleteSearch("saved-search:a b", fetcher)).toEqual({ status: "deleted" });
    expect(calls[0]?.url).toBe("/api/v1/saved-searches?id=saved-search%3Aa%20b");
    expect(calls[0]?.init?.method).toBe("DELETE");
  });

  it("reports a refusal instead of silently doing nothing", async () => {
    expect(await deleteSearch("saved-search:1", json(403, { error: "Forbidden" }))).toEqual({
      status: "failed", message: "Forbidden", httpStatus: 403,
    });
  });
});

describe("running a saved search", () => {
  it("prefers the total number of matches over the page of them it was sent", async () => {
    expect(await runSearch("saved-search:1", json(200, { results: [1, 2, 3], totalMatches: 41 }))).toEqual({ status: "ran", count: 41 });
  });

  it("counts the returned results when the server sent no total", async () => {
    expect(await runSearch("saved-search:1", json(200, { results: [1, 2, 3] }))).toEqual({ status: "ran", count: 3 });
    expect(await runSearch("saved-search:1", json(200, { results: [], totalMatches: 0 }))).toEqual({ status: "ran", count: 0 });
  });

  it("says the count is unknown rather than inventing a zero", async () => {
    expect(await runSearch("saved-search:1", notJson(200))).toEqual({ status: "ran", count: null });
  });

  it("reports a refusal instead of leaving the button on 'Running' forever", async () => {
    expect(await runSearch("saved-search:1", json(404, { error: "Saved search not found" }))).toEqual({
      status: "failed", message: "Saved search not found", httpStatus: 404,
    });
  });

  it("asks the run endpoint, with the id escaped", async () => {
    const { calls, fetcher } = recorder(json(200, { results: [], totalMatches: 0 }));
    await runSearch("saved-search:a b", fetcher);
    expect(calls[0]?.url).toBe("/api/v1/saved-searches?run=saved-search%3Aa%20b");
  });
});

describe("settling an alert-mode save into the list on screen", () => {
  const rows = [
    { ...savedSearch, id: "saved-search:1", alertMode: "all" as const },
    { ...savedSearch, id: "saved-search:2", name: "Other", alertMode: "off" as const },
  ];

  /**
   * The optimistic write already happened: the row on screen reads "all" while the request is open.
   * When the request fails, the row MUST go back to what the server still holds, or the reader is
   * looking at a value nothing was ever told about. The old code put this rollback in the `else` of
   * `if (response.ok)`, so a rejected fetch — the case with no `else` — skipped it entirely.
   */
  it("puts the row back on the stored value when the request never got a verdict", () => {
    const settled = settleAlertModeList(rows, "saved-search:1", "important", { status: "failed", message: TRANSPORT_FAILURE });
    expect(settled[0]?.alertMode).toBe("important");
    expect(alertModeError({ status: "failed", message: TRANSPORT_FAILURE }, "important")).toContain("still important.");
  });

  it("puts the row back when the server refused, and quotes the refusal", () => {
    const refusal = { status: "failed", message: "Saved search not found", httpStatus: 404 } as const;
    expect(settleAlertModeList(rows, "saved-search:1", "off", refusal)[0]?.alertMode).toBe("off");
    expect(alertModeError(refusal, "off")).toBe("Saved search not found — still off.");
  });

  it("leaves every other row alone while rolling one back", () => {
    const settled = settleAlertModeList(rows, "saved-search:1", "important", { status: "failed", message: TRANSPORT_FAILURE });
    expect(settled[1]).toBe(rows[1]);
    expect(rows[0]?.alertMode).toBe("all");
  });

  it("takes the server's row when one came back", () => {
    const stored = { ...savedSearch, id: "saved-search:1", alertMode: "off" as const, updatedAt: "2026-08-25T00:00:00.000Z" };
    const settled = settleAlertModeList(rows, "saved-search:1", "important", { status: "saved", search: stored });
    expect(settled[0]).toEqual(stored);
    expect(alertModeError({ status: "saved", search: stored }, "important")).toBeNull();
  });

  it("keeps the accepted change when the success body could not be read", () => {
    const settled = settleAlertModeList(rows, "saved-search:1", "important", { status: "saved", search: null });
    expect(settled).toBe(rows);
    expect(alertModeError({ status: "saved", search: null }, "important")).toBeNull();
  });
});
