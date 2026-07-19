import { createHmac, timingSafeEqual } from "node:crypto";

export type StaffRole = "admin" | "reviewer";

export interface StaffSession {
  role: StaffRole;
  expiresAt: number;
}

export const STAFF_SESSION_COOKIE = "vial_staff_session";
export const STAFF_SESSION_TTL_SECONDS = 60 * 60 * 8;

function sessionSecret() {
  const configured = process.env.VIAL_SESSION_SECRET?.trim();

  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("VIAL_SESSION_SECRET is required in production");
  }

  return "vial-local-development-secret-change-me";
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
}

export function encodeStaffSession(session: StaffSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeStaffSession(value: string | undefined): StaffSession | null {
  if (!value) {
    return null;
  }

  const [payload, signature] = value.split(".");

  if (!payload || !signature || !constantTimeEqual(signature, sign(payload))) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<StaffSession>;

    if (
      !session.role ||
      !["admin", "reviewer"].includes(session.role) ||
      typeof session.expiresAt !== "number" ||
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }

    return session as StaffSession;
  } catch {
    return null;
  }
}
