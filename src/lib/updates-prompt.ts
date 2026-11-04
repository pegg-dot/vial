/** When the slim "email me" bar may appear. Pure so the rule is tested without a browser. */
export const UPDATES_PROMPT_KEY = "vialgrade:updates-prompt";
export const UPDATES_PROMPT_DELAY_MS = 10_000;
export const UPDATES_PROMPT_SCROLL_PX = 400;

/** Research pages only. Never the signup/confirm/unsubscribe pages themselves. */
export function updatesPromptAllowedOn(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/intelligence/updates" || path.startsWith("/intelligence/updates/")) return false;
  return path === "/intelligence" || path.startsWith("/intelligence/");
}
