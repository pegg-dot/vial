import type { SavedSearch } from "@/server/consumer-intelligence/types";
import { alertModeFailureMessage, serverFailureMessage, TRANSPORT_FAILURE } from "./saved-search-feedback";

/**
 * The four saved-search requests, lifted out of the component so they can be tested without a
 * browser — and, more importantly, so they can be made TOTAL.
 *
 * Every one of these used to be a bare `await fetch(...)` inside a component handler followed by
 * `if (response.ok) … else …`. A `fetch` does not resolve with a failure when the network is gone —
 * it REJECTS. So a rejection fell through both branches: the optimistic value stayed on screen
 * although nothing had been stored, the busy flag was never cleared (leaving the control disabled
 * for the rest of the page's life), and the rejection went unhandled.
 *
 * Each function below resolves for every outcome — success, refusal, and no answer at all — so a
 * caller cannot skip its cleanup by forgetting one. The caller decides what to undo and what to say.
 */

const ENDPOINT = "/api/v1/saved-searches";

export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const browserFetch: Fetcher = (input, init) => fetch(input, init);

/** Every action can end here: the reader needs a sentence, and the caller needs to roll back. */
export interface ActionFailure {
  status: "failed";
  message: string;
  /** Present when the server answered. Absent when the request never reached a verdict. */
  httpStatus?: number;
}

type Answered = { ok: true; body: unknown };

async function send(fetcher: Fetcher, url: string, init: RequestInit | undefined, fallback: string): Promise<Answered | ActionFailure> {
  let response: Response;
  try {
    response = await fetcher(url, init);
  } catch {
    // Offline, DNS gone, a server replaced mid-deploy. Nothing was stored.
    return { status: "failed", message: TRANSPORT_FAILURE };
  }
  // The status already decided the verdict; a body that will not parse must not overturn it.
  const body = await response.json().catch(() => null);
  if (response.ok) return { ok: true, body };
  return { status: "failed", message: serverFailureMessage(body, fallback), httpStatus: response.status };
}

/** A success body that is not a saved search is not a reason to undo what the server accepted. */
function asSavedSearch(body: unknown): SavedSearch | null {
  return body && typeof body === "object" && typeof (body as SavedSearch).id === "string" ? (body as SavedSearch) : null;
}

const jsonInit = (method: string, payload: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});

export type SaveAlertModeResult = { status: "saved"; search: SavedSearch | null } | ActionFailure;

export async function saveAlertMode(id: string, alertMode: SavedSearch["alertMode"], fetcher: Fetcher = browserFetch): Promise<SaveAlertModeResult> {
  const result = await send(fetcher, ENDPOINT, jsonInit("PATCH", { id, alertMode }), "Alert mode could not be saved");
  return "status" in result ? result : { status: "saved", search: asSavedSearch(result.body) };
}

/**
 * What the list becomes once an alert-mode save has settled.
 *
 * This is the half the audit found broken. The rollback lived in the `else` of
 * `if (response.ok)`, so an outcome that was neither — a rejected fetch — left the optimistic value
 * sitting on screen as a value the server had never been told about. Here a failure ALWAYS restores
 * `previous`, because every outcome goes through one expression.
 */
export function settleAlertModeList(searches: SavedSearch[], id: string, previous: SavedSearch["alertMode"], result: SaveAlertModeResult): SavedSearch[] {
  if (result.status === "failed") return searches.map(entry => (entry.id === id ? { ...entry, alertMode: previous } : entry));
  const stored = result.search;
  // No row came back (an unreadable success body). The server accepted the change; keep it.
  if (!stored) return searches;
  return searches.map(entry => (entry.id === id ? stored : entry));
}

/** The sentence that goes with that settlement, or nothing when there is nothing to report. */
export function alertModeError(result: SaveAlertModeResult, previous: SavedSearch["alertMode"]): string | null {
  return result.status === "failed" ? alertModeFailureMessage(result.message, previous) : null;
}

export type CreateSearchResult = { status: "created"; search: SavedSearch | null } | ActionFailure;

/**
 * The refusal ordinary use provokes here is `409 "A saved search already uses that name"` — the
 * route's answer to the `UNIQUE(user_id, name)` constraint. It was swallowed by an `if (response.ok)`
 * with no `else`: the inputs kept their values, nothing appeared, and the button read as broken.
 */
export async function createSearch(
  input: { name: string; query: string; alertMode: SavedSearch["alertMode"] },
  fetcher: Fetcher = browserFetch,
): Promise<CreateSearchResult> {
  const result = await send(fetcher, ENDPOINT, jsonInit("POST", { ...input, filters: {} }), "The search could not be saved.");
  return "status" in result ? result : { status: "created", search: asSavedSearch(result.body) };
}

export type DeleteSearchResult = { status: "deleted" } | ActionFailure;

export async function deleteSearch(id: string, fetcher: Fetcher = browserFetch): Promise<DeleteSearchResult> {
  const result = await send(fetcher, `${ENDPOINT}?id=${encodeURIComponent(id)}`, { method: "DELETE" }, "This saved search could not be deleted.");
  return "status" in result ? result : { status: "deleted" };
}

export type RunSearchResult = { status: "ran"; count: number | null } | ActionFailure;

export async function runSearch(id: string, fetcher: Fetcher = browserFetch): Promise<RunSearchResult> {
  const result = await send(fetcher, `${ENDPOINT}?run=${encodeURIComponent(id)}`, undefined, "This saved search could not be run.");
  if ("status" in result) return result;
  const payload = result.body as { results?: unknown[]; totalMatches?: number } | null;
  // `totalMatches` is the honest number; `results` is the page of them the server chose to send.
  const count = typeof payload?.totalMatches === "number" ? payload.totalMatches
    : Array.isArray(payload?.results) ? payload.results.length
    : null;
  return { status: "ran", count };
}
