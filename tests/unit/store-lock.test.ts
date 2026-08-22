import { describe, expect, it } from "vitest";
import { lockDecision, processAlive } from "@/server/db/store-lock";

// The file-backed store is single-writer, and nothing enforced it — the collectors said so in a
// header comment and that was all. On 2026-08-22 a collector was mid-run when a second process
// opened the same store to check on it; every subsequent boot died with a bare wasm
// `RuntimeError: Aborted()`, which reads like a broken runtime and is actually a broken store.
// The data survived only because there was a snapshot and the collectors are idempotent.
//
// A comment is not a guard. This is the decision the guard makes.

describe("deciding whether a collector may open the store", () => {
  it("acquires when nothing holds the lock", () => {
    expect(lockDecision({ existing: null, myPid: 100, isAlive: () => true })).toEqual({ action: "acquire" });
  });

  it("blocks when another live process holds it", () => {
    const d = lockDecision({
      existing: { pid: 55, name: "collect-domain-age", at: "2026-08-22T11:24:00Z" },
      myPid: 100,
      isAlive: () => true,
    });
    expect(d.action).toBe("blocked");
    expect(d.holder?.name).toBe("collect-domain-age");
  });

  // A crash leaves the note behind. Refusing forever on a dead holder would make one crash brick
  // every collector until someone deleted a file they'd have to know about.
  it("takes over a lock whose holder is gone", () => {
    const d = lockDecision({
      existing: { pid: 55, name: "collect-domain-age", at: "2026-08-22T11:24:00Z" },
      myPid: 100,
      isAlive: () => false,
    });
    expect(d.action).toBe("acquire");
    expect(d.tookOverStale).toBe(true);
  });

  it("does not block itself", () => {
    expect(lockDecision({
      existing: { pid: 100, name: "collect-domain-age", at: "2026-08-22T11:24:00Z" },
      myPid: 100,
      isAlive: () => true,
    }).action).toBe("acquire");
  });

  // A note we cannot read is not evidence that someone is writing. Treating it as a live holder
  // would be the same brick-forever failure, reached a different way.
  it("takes over an unreadable lock", () => {
    expect(lockDecision({ existing: "corrupt", myPid: 100, isAlive: () => true }).action).toBe("acquire");
  });
});

// Found by trying to prove the guard blocks, and watching it not block.
//
// `process.kill(pid, 0)` throws for two completely different reasons: ESRCH means no such process,
// EPERM means the process is very much alive and you simply may not signal it. Catching both as
// "dead" made the lock hand itself over to a live holder — a guard that cannot fail, which is the
// only kind worse than no guard.
describe("is that process actually alive", () => {
  it("says yes for this very process", () => {
    expect(processAlive(process.pid)).toBe(true);
  });

  it("says no for a pid that cannot exist", () => {
    expect(processAlive(2_147_483_646)).toBe(false);
  });

  // pid 1 exists on every unix. An unprivileged process gets EPERM signalling it; a privileged one
  // succeeds. Either way the honest answer is "alive", and only the EPERM path was broken.
  it("says yes for a process it is not allowed to signal", () => {
    expect(processAlive(1)).toBe(true);
  });
});
