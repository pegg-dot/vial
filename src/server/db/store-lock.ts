// A door lock for the file-backed store.
//
// PGlite's on-disk store is single-writer. Every collector says so in a header comment, and a
// comment is not a guard: on 2026-08-22 a collector was mid-run when a second process opened the
// same store to check on its progress, and every boot afterwards died with a bare wasm
// `RuntimeError: Aborted()` — which reads like a broken runtime and is in fact a broken store.
// The data survived only because a snapshot existed and the collectors are idempotent.
//
// This is deliberately ADVISORY and deliberately small: one note recording who is writing. It
// binds the scripts that opt into it, not the operating system, and it never blocks on a holder
// that is no longer running — a crash must not brick every collector until someone knows to
// delete a file.

import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export interface LockNote { pid: number; name: string; at: string }

export type LockDecision =
  | { action: "acquire"; tookOverStale?: boolean; holder?: undefined }
  | { action: "blocked"; holder: LockNote; tookOverStale?: undefined };

/**
 * Whether this process may open the store, given whatever note is already there.
 *
 * `existing` is the parsed note, `null` when there is none, or the string "corrupt" when the file
 * could not be read as one. An unreadable note is not evidence that anybody is writing, so it is
 * taken over rather than obeyed.
 */
export function lockDecision(input: {
  existing: LockNote | null | "corrupt";
  myPid: number;
  isAlive: (pid: number) => boolean;
}): LockDecision {
  const { existing, myPid, isAlive } = input;
  if (existing === null || existing === "corrupt") return { action: "acquire" };
  if (existing.pid === myPid) return { action: "acquire" };
  if (!isAlive(existing.pid)) return { action: "acquire", tookOverStale: true };
  return { action: "blocked", holder: existing };
}

/**
 * Whether a pid belongs to a running process.
 *
 * Signal 0 checks for existence without delivering anything, but it throws for two opposite
 * reasons: ESRCH means there is no such process, and EPERM means the process is alive and this
 * user simply may not signal it. Treating both as dead made the lock hand itself over to a live
 * holder — the guard looked correct and could not fail.
 */
export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException)?.code === "EPERM";
  }
}

function lockPath(): string {
  return path.join(process.cwd(), ".data", "collector.lock");
}

function readNote(file: string): LockNote | null | "corrupt" {
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as LockNote;
    return typeof parsed?.pid === "number" ? parsed : "corrupt";
  } catch {
    return "corrupt";
  }
}

export class StoreBusyError extends Error {}

/**
 * Claim the store for this process, or throw with a message that says who has it.
 *
 * A no-op when the store is not file-backed — a managed Postgres handles its own concurrency, and
 * an in-memory store is private to the process. Returns a release function; it is also wired to
 * `process.on("exit")` so a script ending via `process.exit(0)` still lets go.
 */
export function acquireStoreLock(name: string): () => void {
  if (process.env.DATABASE_URL?.trim() || process.env.VIALGRADE_PGLITE_MEMORY === "true") return () => {};

  const file = lockPath();
  mkdirSync(path.dirname(file), { recursive: true });

  const decision = lockDecision({ existing: readNote(file), myPid: process.pid, isAlive: processAlive });
  if (decision.action === "blocked") {
    const { name: holder, pid, at } = decision.holder;
    throw new StoreBusyError(
      `The store is already open by "${holder}" (pid ${pid}, since ${at}).\n` +
      `Running two writers against the file-backed store corrupts it, so this run is stopping.\n` +
      `Wait for that run to finish. If you are certain it is gone, delete ${file}.`,
    );
  }
  if (decision.tookOverStale) {
    console.log(`(taking over a lock left by a run that is no longer alive)`);
  }

  writeFileSync(file, JSON.stringify({ pid: process.pid, name, at: new Date().toISOString() }));

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try {
      const note = readNote(file);
      if (note && note !== "corrupt" && note.pid === process.pid) unlinkSync(file);
    } catch { /* releasing is best-effort; a stale note is taken over next run */ }
  };
  process.on("exit", release);
  return release;
}
