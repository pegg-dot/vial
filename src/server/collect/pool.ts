// Bounded, key-exclusive concurrency for the collection and provenance sweeps.
//
// Both sweeps used to run their work strictly one item at a time, which was the right shape when a
// tick fired every 15 or 30 minutes: the day's work was spread across 48–96 invocations and each
// one only had to nibble. On a once-a-day schedule the same loop has to do the whole day inside a
// single function lifetime, and sequential network fetches cannot: 897 enrolled listings at ~1s
// each is a quarter of an hour, against a ceiling measured in minutes.
//
// Two rules make the parallelism safe to point at other people's servers:
//
//   - `concurrency` caps how much is ever in flight at once, so the fleet is never a stampede.
//   - `keyOf` serialises within a key. The key is the vendor, so we never open two connections to
//     the same storefront — the pool goes wide across hosts, never deep into one. A blocked or slow
//     vendor therefore costs its own share of the run and nobody else's.
//
// `budgetMs` stops the pool STARTING work it cannot finish, which is the property the callers
// depend on: a half-run target settles as a failure and backs off exponentially, so overrunning is
// worse than under-running. Work not started is simply still queued tomorrow.

export interface PoolResult {
  completed: number;
  failed: number;
  budgetExhausted: boolean;
}

export async function runPooled<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  options: { concurrency: number; keyOf: (item: T) => string; budgetMs?: number },
): Promise<PoolResult> {
  const { concurrency, keyOf, budgetMs } = options;
  const deadline = budgetMs == null ? Infinity : Date.now() + budgetMs;
  const queue = [...items];
  const active = new Set<string>();
  const running = new Set<Promise<void>>();
  let completed = 0;
  let failed = 0;
  let budgetExhausted = false;

  // An item whose key is busy is not dropped — it is skipped for now and reconsidered as soon as
  // any in-flight item finishes, which is the only moment a key can free up.
  const takeRunnable = (): T | undefined => {
    const index = queue.findIndex((item) => !active.has(keyOf(item)));
    return index === -1 ? undefined : queue.splice(index, 1)[0];
  };

  while (queue.length > 0 || running.size > 0) {
    while (running.size < concurrency) {
      if (Date.now() >= deadline) { budgetExhausted = true; break; }
      const item = takeRunnable();
      if (item === undefined) break;
      const key = keyOf(item);
      active.add(key);
      const task = (async () => {
        try {
          await worker(item);
        } catch {
          // A vendor that blocks us, times out, or changes platform is the caller's business to
          // record — never a reason to abandon the rest of the sweep.
          failed += 1;
        } finally {
          // Released here rather than after the await below, so the key frees the instant its work
          // ends and the next item for that vendor becomes runnable on this same pass.
          active.delete(key);
          completed += 1;
        }
      })();
      running.add(task);
      void task.then(() => { running.delete(task); });
    }
    if (running.size === 0) break;
    await Promise.race(running);
  }

  return { completed, failed, budgetExhausted };
}
