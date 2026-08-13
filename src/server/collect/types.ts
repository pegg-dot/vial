/**
 * What a collector hands back to the queue.
 *
 * A collector NEVER throws for a source problem. A government API that 500s, rate-limits, returns
 * an empty body, or changes shape is an ordinary Tuesday — it settles as `ok: false` so the queue
 * backs the target off and `collector_runs` records the failure, which is what
 * `detectBrokenCollectors` reads to notice a source has silently died. A thrown error would look
 * identical to a bug in our own code.
 */
export interface CollectorOutcome {
  items: number;
  ok: boolean;
  error?: string;
}
