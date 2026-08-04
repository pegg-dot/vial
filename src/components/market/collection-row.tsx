import Link from "next/link";
import { ArrowRight } from "lucide-react";

// A titled horizontal snap-carousel. Children are tiles the caller sizes
// (w-[280px] shrink-0 snap-start). Reuses the site-wide scroll-fade carousel pattern.
export function CollectionRow({
  eyebrow,
  title,
  blurb,
  seeAllHref,
  children,
}: {
  eyebrow: string;
  title: string;
  blurb?: string;
  seeAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#0e8f80]">{eyebrow}</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em]">{title}</h2>
          {blurb && <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{blurb}</p>}
        </div>
        {seeAllHref && (
          <Link href={seeAllHref} className="ink hard-sm press inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#111214]">
            See all <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      <div className="scroll-fade-x -mx-5 mt-6 overflow-x-auto px-5 pb-3 no-scrollbar sm:-mx-8 sm:px-8">
        <div className="flex w-max snap-x snap-mandatory gap-4">{children}</div>
      </div>
    </section>
  );
}
