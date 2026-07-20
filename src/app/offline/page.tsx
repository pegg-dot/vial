import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Ambient mode</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">You&rsquo;re offline</h1>
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">VIAL can&rsquo;t reach the network right now. Pages you&rsquo;ve already opened are still readable from your device cache — reconnect to pull the latest reviewed records and receive change alerts.</p>
    </div>
  );
}
