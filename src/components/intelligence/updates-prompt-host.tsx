import { cookies } from "next/headers";
import { decodeSessionEnvelope, SESSION_COOKIE } from "@/server/auth/session-envelope";
import { UpdatesPrompt } from "./updates-prompt";

/**
 * Renders the first-visit email prompt for signed-out readers only. A valid, unexpired session
 * cookie (decode checks expiry) is enough to hide it; no database read happens here. It no longer
 * waits for mail to be configured: a signup made before the update email starts is kept and
 * confirmed when it does (see requestSubscription).
 */
export async function UpdatesPromptHost() {
  const envelope = decodeSessionEnvelope((await cookies()).get(SESSION_COOKIE)?.value);
  if (envelope) return null;
  return <UpdatesPrompt />;
}
