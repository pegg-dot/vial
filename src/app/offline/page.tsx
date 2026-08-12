import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="ink-1 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.18em] text-[#111214]">Ambient mode</p>
      <h1 className="mt-4 text-3xl font-extrabold tracking-[-.04em] text-[#111214]">You&rsquo;re offline</h1>
      <p className="mt-4 text-sm font-medium leading-6 text-[var(--muted)]">VialGrade can&rsquo;t reach the network right now. Pages you&rsquo;ve already opened are still readable from your device cache — reconnect to pull the latest reviewed records and receive change alerts.</p>
    </div>
  );
}
