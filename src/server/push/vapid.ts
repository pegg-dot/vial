export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

// Web push is self-hosted via VAPID keys — no third-party provider. When the keys are
// not configured, push is simply disabled (fail-safe): nothing is sent, nothing breaks.
export function getVapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT?.trim() || "mailto:ops@vial.example" };
}
