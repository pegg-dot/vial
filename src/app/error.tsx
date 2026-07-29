"use client";

import Link from "next/link";
import { useEffect } from "react";

// Styled recovery boundary for any server-component/data throw. Without this, a
// repository error dropped the user on Next's default unstyled error screen.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
      <div className="ink hard-lg rounded-[24px] bg-white p-8">
        <h1 className="text-3xl font-extrabold tracking-[-.03em] text-[#111214]">Something went wrong on our side.</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">This page hit an unexpected error. It&rsquo;s us, not you — try again, or head back to the market.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="ink hard-sm press h-11 rounded-full bg-[#111214] px-6 text-sm font-bold text-white">Try again</button>
          <Link href="/market" className="ink-1 hard-sm press grid h-11 place-items-center rounded-full bg-white px-6 text-sm font-bold text-[#111214]">Back to market</Link>
        </div>
      </div>
    </section>
  );
}
