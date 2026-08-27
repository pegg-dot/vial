/**
 * Was the database refusing a duplicate, or was it something else entirely?
 *
 * The saved-search routes used to decide with `String(error).toLowerCase().includes("unique")`.
 * That relabels ANY failure whose text happens to carry those six letters as a duplicate-name
 * conflict: a message about a "unique extractor", a constraint or index whose name ends in
 * `_unique`, a driver note about a unique index being rebuilt. The caller then gets
 * `409 "A saved search already uses that name"` for a request whose name was never the problem,
 * and the real failure is swallowed with it.
 *
 * Postgres states this exactly once and unambiguously: SQLSTATE 23505. Both drivers this project
 * opens a database with — `pg` and PGlite — surface it verbatim on `error.code`.
 */
export const PG_UNIQUE_VIOLATION = "23505";

/**
 * The sentence Postgres itself writes for 23505, kept only as a fallback for an error that crossed
 * a boundary which dropped the structured fields (a serialized worker error, a wrapper that
 * re-threw with nothing but the message). It matches the whole sentence, not the word "unique".
 */
const UNIQUE_VIOLATION_MESSAGE = /duplicate key value violates unique constraint/i;

/** How far down a `cause` chain to look before giving up. Wrappers nest; they do not nest deeply. */
const MAX_CAUSE_DEPTH = 8;

export function isUniqueViolation(error: unknown): boolean {
  let node: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof node !== "object" || node === null) return false;
    const candidate = node as { code?: unknown; message?: unknown; cause?: unknown };
    if (candidate.code === PG_UNIQUE_VIOLATION) return true;
    if (typeof candidate.message === "string" && UNIQUE_VIOLATION_MESSAGE.test(candidate.message)) return true;
    node = candidate.cause;
  }
  return false;
}
