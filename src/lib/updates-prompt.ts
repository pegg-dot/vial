/** When the first-visit email prompt may appear. Pure so the rule is tested without a browser. */
export const UPDATES_PROMPT_KEY = "vialgrade:updates-prompt";
/** Long enough for the page to settle, short enough to count as "on arrival". */
export const UPDATES_PROMPT_DELAY_MS = 1_500;

// Places the prompt never opens: the signup pages themselves, sign-in and account areas, staff
// pages, the legal notices (a reader there is reading the terms, not the site), and retired
// checkout paths. Exact root or anything under it.
const NEVER_ON = ["/intelligence/updates", "/legal", "/login", "/register", "/admin", "/account", "/seller", "/lab", "/orders",
  "/watchlist", "/for-you", "/saved-searches", "/cart", "/checkout", "/go", "/api", "/offline"];

/** Every public reading page: research, compounds, vendors, labs and the rest. */
export function updatesPromptAllowedOn(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return !NEVER_ON.some((root) => path === root || path.startsWith(root + "/"));
}

/**
 * Once per browser: the prompt is marked as seen the moment it opens, whatever the reader then
 * does with it. Any stored value counts, including the "dismissed" the earlier bar wrote.
 */
export function updatesPromptSeen(stored: string | null): boolean {
  return stored !== null;
}
