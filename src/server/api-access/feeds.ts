// Filters and ranks published opportunity signals into a risk-feed subset. Pure —
// the endpoint supplies the published signals, this shapes them. Generic on the two
// fields it needs so it's trivially testable.
export function filterRiskSignals<T extends { signalType: string; score: number }>(
  signals: T[],
  opts: { types?: string[]; minScore?: number; limit?: number } = {},
): T[] {
  const types = opts.types && opts.types.length ? new Set(opts.types) : null;
  let out = signals.filter((signal) => {
    if (types && !types.has(signal.signalType)) return false;
    if (opts.minScore !== undefined && signal.score < opts.minScore) return false;
    return true;
  });
  out = out.sort((a, b) => b.score - a.score);
  if (opts.limit !== undefined) out = out.slice(0, opts.limit);
  return out;
}
