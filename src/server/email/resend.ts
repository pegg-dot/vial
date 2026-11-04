/**
 * Minimal Resend client (https://resend.com/docs/api-reference/emails/send-email). No SDK: one
 * HTTPS call, injectable fetch so tests never reach the network. The API key is read from the
 * environment only and is never logged or returned.
 */
export type OutboundEmail = { to: string; subject: string; text: string; html: string; headers?: Record<string, string> };
export type EmailConfig = { apiKey: string; from: string; siteUrl: string };

export function emailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.DIGEST_FROM_EMAIL?.trim();
  const siteUrl = (env.NEXT_PUBLIC_SITE_URL?.trim() || "").replace(/\/+$/, "");
  if (!apiKey || !from || !/^https:\/\//.test(siteUrl) && !/^http:\/\/localhost(:\d+)?$/.test(siteUrl)) return null;
  return { apiKey, from, siteUrl };
}

export async function sendEmail(
  message: OutboundEmail,
  config: EmailConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean }> {
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + config.apiKey, "content-type": "application/json" },
      body: JSON.stringify({ from: config.from, to: [message.to], subject: message.subject, text: message.text, html: message.html, headers: message.headers }),
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}
