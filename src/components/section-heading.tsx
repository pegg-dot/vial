import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  linkLabel,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{eyebrow}</p>}
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">{title}</h2>
        {description && <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">{description}</p>}
      </div>
      {href && linkLabel && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold hover:gap-2.5">
          {linkLabel} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
