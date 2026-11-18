/** The email signup, as the browser sees it. Shared by the signup page and the first-visit prompt. */
export const UPDATES_SUBSCRIBE_PATH = "/intelligence/updates/subscribe";

export type SubscribeStatus = "idle" | "sent" | "saved" | "invalid" | "unavailable" | "needs-consent" | "slow-down";

/** Statuses that mean the address is now held (or already was). */
export function signupSucceeded(status: SubscribeStatus): boolean {
  return status === "sent" || status === "saved";
}

export const SUBSCRIBE_MESSAGE: Record<SubscribeStatus, string> = {
  idle: "",
  sent: "Check your inbox for a confirmation link. Nothing is sent until you confirm. If you do not see it in a few minutes, look in spam.",
  saved: "You are on the list. The update email has not started yet: when it does, we will send one confirmation link first, and nothing else until you click it.",
  invalid: "That does not look like an email address. Please check it and try again.",
  unavailable: "We could not take signups just now, so nothing was saved. Please try again later.",
  "needs-consent": "Please tick the box so we know you agree.",
  "slow-down": "Too many attempts from this connection. Please try again in an hour.",
};

const STATUSES = new Set<string>(Object.keys(SUBSCRIBE_MESSAGE));

/** Reads the endpoint's reply; anything unexpected is "unavailable", never a silent success. */
export function parseSubscribeReply(body: unknown): SubscribeStatus {
  const status = body && typeof body === "object" ? (body as { status?: unknown }).status : undefined;
  return typeof status === "string" && STATUSES.has(status) && status !== "idle" ? (status as SubscribeStatus) : "unavailable";
}
