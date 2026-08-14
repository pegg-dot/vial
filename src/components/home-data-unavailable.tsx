import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * The homepage when the live catalog cannot be read.
 *
 * Deliberately NOT a homepage with zeros in it. The headline figures — vendors tracked, lab tests
 * on record — are this site's credibility, and rendering "0 vendors" during an outage would state
 * something false with the same confidence as the real number. Publishing a number we cannot stand
 * behind is precisely the behaviour VialGrade exists to catch in vendor marketing, so it is not
 * something to do to our own readers.
 *
 * The pages that need no live data stay open and are linked here, because they are also the ones
 * worth reading first: how the grading works, and what a grade does not mean.
 */
export function HomeDataUnavailable() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-[900px] items-center px-5 py-20 sm:px-8">
      <div className="ink hard w-full rounded-[18px] bg-white p-8 sm:p-12">
        <span className="ink-1 inline-flex items-center gap-1.5 rounded-full bg-[#fff6e6] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.12em] text-[#b26a00]">
          <AlertTriangle className="size-3.5" /> Live data unavailable
        </span>
        <h1 className="mt-5 text-[clamp(1.9rem,4vw,2.8rem)] font-extrabold leading-[1.02] tracking-[-.04em]">
          We can&rsquo;t reach the catalogue right now.
        </h1>
        <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">
          Rather than show you numbers we can&rsquo;t stand behind, we&rsquo;d rather show you
          nothing. Vendor grades, prices and lab tests are temporarily unreadable — they are not
          zero, and nothing has been lost. This usually clears within a few minutes.
        </p>
        <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">
          These pages don&rsquo;t depend on live data and are working normally:
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/grades" className="ink-1 hard press rounded-full bg-[#111214] px-5 py-2.5 text-sm font-bold text-white">
            What a grade actually means
          </Link>
          <Link href="/how-we-check" className="ink-1 hard press rounded-full bg-white px-5 py-2.5 text-sm font-bold">
            How we check
          </Link>
          <Link href="/about" className="ink-1 hard press rounded-full bg-white px-5 py-2.5 text-sm font-bold">
            About VialGrade
          </Link>
        </div>
      </div>
    </section>
  );
}
