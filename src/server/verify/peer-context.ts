// What a fact means once you know how common it is.
//
// Nineteen of the fifty-eight vendors we hold a domain for have no Trustpilot profile. Rendered on
// its own, on each of those nineteen vendor pages, that reads as a mark against them. Rendered with
// its base rate — "as with 19 of 58 tracked vendors" — it reads as what it is: ordinary. Same fact,
// and only one of the two is honest.
//
// This is the arithmetic behind the owner's instruction to "level the playing field": a signal is
// worth drawing attention to in proportion to how far it moves a reader off normal, and a signal
// most of the field shares moves them nowhere.
//
// It produces phrasing, never a verdict. Nothing here may change a grade.

/**
 * Above this share of peers, a signal is too common to distinguish anyone.
 *
 * One in four. The rule is deliberately a principle rather than a fitted number — the temptation
 * was to pick a threshold that sorted the two cases in front of us (19 of 58 vendors with no
 * Trustpilot profile; 14 of 58 with a rated one) and call it calibrated, which is overfitting to a
 * sample of two. A quarter is where "some vendors do this" becomes "lots of vendors do this", and
 * it is defensible without reference to today's corpus.
 *
 * It is a PRODUCT decision, not a measurement. Moving it changes which facts are drawn to a
 * reader's attention, so it lives here as one named constant rather than scattered as a literal.
 */
export const REMARKABLE_CEILING = 0.25;

/** Below this many peers there is no base rate, only a small sample pretending to be one. */
const MIN_CORPUS = 8;

/**
 * Whether a signal shared by `count` of `total` peers is unusual enough to be worth surfacing.
 *
 * A tiny corpus always answers false. One vendor out of three is not rare, it is unmeasured, and
 * letting a thin catalogue manufacture significance is how a trust product starts inventing
 * distinctions it cannot support.
 */
export function isRemarkable(count: number, total: number): boolean {
  if (!Number.isFinite(count) || !Number.isFinite(total)) return false;
  if (total < MIN_CORPUS || count <= 0 || count > total) return false;
  return count / total < REMARKABLE_CEILING;
}

export interface PeerContext {
  remarkable: boolean;
  /** "as with 19 of 58 tracked vendors" — empty when there is no corpus worth comparing against. */
  phrase: string;
  /** "highest rating of 14 rated" — empty unless a rank was supplied and the field is real. */
  rankPhrase: string;
}

const ordinal = (n: number): string => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
};

const plural = (n: number, noun: string): string => (n === 1 ? noun : `${noun}s`);

/**
 * A fact stated alongside how common it is among peers.
 *
 * Returns empty strings rather than a hedge when there is nothing honest to say — no corpus, an
 * impossible count, a field of one. A caller rendering an empty phrase shows nothing, which is the
 * correct behaviour: silence beats a comparison that does not hold.
 */
export function peerContext(input: {
  count: number;
  total: number;
  noun: string;
  rank?: number;
  rankedOf?: number;
  metric?: string;
}): PeerContext {
  const { count, total, noun, rank, rankedOf, metric = "rating" } = input;

  const usable = Number.isFinite(count) && Number.isFinite(total) && total >= MIN_CORPUS && count > 0 && count <= total;
  const remarkable = isRemarkable(count, total);

  let phrase = "";
  if (usable) {
    const tail = `${count} of ${total} ${plural(total, noun)}`;
    if (!remarkable) phrase = `as with ${tail}`;
    else if (count === 1) phrase = `the only ${tail}`;
    else phrase = `one of only ${tail}`;
  }

  // A rank needs a field. "Highest of 1" implies competition that did not happen.
  let rankPhrase = "";
  if (rank && rankedOf && rankedOf > 1 && rank >= 1 && rank <= rankedOf) {
    if (rank === 1) rankPhrase = `highest ${metric} of ${rankedOf} rated`;
    else if (rank === rankedOf) rankPhrase = `lowest ${metric} of ${rankedOf} rated`;
    else rankPhrase = `${ordinal(rank)} of ${rankedOf} rated`;
  }

  return { remarkable, phrase, rankPhrase };
}
