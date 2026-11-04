import { cookies } from "next/headers";
import { decodeSessionEnvelope, SESSION_COOKIE } from "@/server/auth/session-envelope";
import { UpdatesPrompt } from "./updates-prompt";
import { emailConfig } from "@/server/email/resend";

/**
 * Renders the bar only for signed-out readers and only when the email list can actually confirm an
 * address. A valid session cookie is enough to hide it; no database read happens here.
 */
export async function UpdatesPromptHost() {
  if (!emailConfig()) return null;
  const envelope = decodeSessionEnvelope((await cookies()).get(SESSION_COOKIE)?.value);
  if (envelope && envelope.expiresAt > Date.now()) return null;
  return <UpdatesPrompt />;
}
