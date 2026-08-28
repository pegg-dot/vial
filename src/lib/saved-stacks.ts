// A saved stack rides in the same store as a saved listing — `user_watchlists` for a signed-in
// reader, localStorage for a guest — under a namespaced key. That is what makes the guest→account
// merge, the header badge and the Saved page work for stacks without a second persistence path
// to keep in step. The key is the ONLY thing that tells the two apart, so every reader of the store
// splits on it here and nowhere else; a listing slug can never begin with "stack:".
import { stackBySlug } from "./stacks";

export const STACK_KEY_PREFIX = "stack:";
export const stackKey = (slug: string): string => `${STACK_KEY_PREFIX}${slug}`;
export const isStackKey = (key: string): boolean => key.startsWith(STACK_KEY_PREFIX);
export const stackSlugFromKey = (key: string): string => key.slice(STACK_KEY_PREFIX.length);

/**
 * Only stacks that exist. A slug from an old localStorage entry, a renamed stack, or a hand-edited
 * request would otherwise be counted by the header badge while nothing rendered for it —
 * "Saved 2" over one card. Pruned at every boundary the store crosses: guest hydration, the
 * account read, the API.
 */
export const pruneStackSlugs = (slugs: readonly string[]): string[] => slugs.filter((slug) => Boolean(stackBySlug(slug)));

/** One stored list → the listing slugs and the stack slugs, each in its own words. */
export function splitWatchlist(keys: readonly string[]): { listings: string[]; stacks: string[] } {
  const listings: string[] = [];
  const stacks: string[] = [];
  for (const key of keys) {
    if (isStackKey(key)) stacks.push(stackSlugFromKey(key));
    else listings.push(key);
  }
  return { listings, stacks };
}
