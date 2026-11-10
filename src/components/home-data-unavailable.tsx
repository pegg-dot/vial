import { AlertTriangle } from "lucide-react";
import { Chip, Frame, Notice, Pill, UI } from "@/components/intelligence/research-ui";

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
export function DataUnavailable({ surface = "the catalogue" }: { surface?: string }) {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-[900px] items-center px-5 py-20 sm:px-8">
      <Frame pad="lg" className="w-full">
        <Chip tone="warn" icon={AlertTriangle}>Live data unavailable</Chip>
        <h1 className={UI.h1Compact + " mt-5"}>We can&rsquo;t reach {surface} right now.</h1>
        <Notice tone="warn" className="mt-6 max-w-2xl">
          <p>
            Rather than show you numbers we can&rsquo;t stand behind, we&rsquo;d rather show you
            nothing. Vendor grades, prices and lab tests are temporarily unreadable — they are not
            zero, and nothing has been lost. This usually clears within a few minutes.
          </p>
        </Notice>
        <p className={UI.body + " mt-5 max-w-2xl"}>
          These pages don&rsquo;t depend on live data and are working normally:
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Pill href="/grades" variant="ink">What a grade actually means</Pill>
          <Pill href="/how-we-check">How we check</Pill>
          <Pill href="/intelligence">About VialGrade</Pill>
        </div>
      </Frame>
    </section>
  );
}

/** The homepage variant, kept as a named export so the homepage reads clearly at its call site. */
export function HomeDataUnavailable() {
  return <DataUnavailable surface="the catalogue" />;
}
