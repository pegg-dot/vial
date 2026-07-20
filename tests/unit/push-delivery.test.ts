import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getVapidConfig } from "@/server/push/vapid";
import { sendPushToUser } from "@/server/push/delivery";

const saved = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY, subj: process.env.VAPID_SUBJECT };
afterEach(() => {
  process.env.VAPID_PUBLIC_KEY = saved.pub; process.env.VAPID_PRIVATE_KEY = saved.priv; process.env.VAPID_SUBJECT = saved.subj;
});

describe("VAPID config", () => {
  it("returns a config when keys are set", () => {
    process.env.VAPID_PUBLIC_KEY = "pub"; process.env.VAPID_PRIVATE_KEY = "priv"; process.env.VAPID_SUBJECT = "mailto:x@y.z";
    expect(getVapidConfig()).toEqual({ publicKey: "pub", privateKey: "priv", subject: "mailto:x@y.z" });
  });
  it("is null (push disabled) when a key is missing", () => {
    delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY;
    expect(getVapidConfig()).toBeNull();
  });
});

describe("sendPushToUser — fail-safe", () => {
  beforeEach(() => { delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY; });
  it("no-ops (never throws, never touches the DB) when push is disabled", async () => {
    // No db passed — if it tried to load subscriptions it would throw; it must short-circuit on the VAPID check.
    const result = await sendPushToUser("user:x", { title: "t", body: "b" });
    expect(result).toEqual({ sent: 0, pruned: 0, skipped: "vapid-unset" });
  });
});
