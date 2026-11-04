import type { ReactNode } from "react";

export type DossierTocItem = { id: string; label: string };

/**
 * One contents list for every dossier, in the same order every time: a sticky column beside the
 * page on large screens and a horizontal bar under the header on phones. Plain anchors, no script.
 */
export function DossierToc({ items }: { items: readonly DossierTocItem[] }) {
  return (
    <nav aria-label="Research dossier sections"
      className="sticky top-[72px] z-20 -mx-5 border-b-2 border-[#111214] bg-[rgba(247,247,244,.96)] px-5 backdrop-blur-md sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
      <ol className="flex gap-1 overflow-x-auto py-2 lg:sticky lg:top-28 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:py-0">
        {items.map((item, index) => (
          <li key={item.id} className="shrink-0">
            <a href={"#" + item.id}
              className="flex min-h-11 items-center gap-2.5 rounded-full px-3.5 text-[13px] font-bold text-[#3a3d46] hover:bg-black/[.06] hover:text-[#111214] lg:min-h-9 lg:rounded-lg lg:px-2.5">
              <span aria-hidden="true" className="font-mono text-[11px] text-[#2b31d8]">{String(index + 1).padStart(2, "0")}</span>
              <span className="whitespace-nowrap">{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The single frame every dossier section uses, so cards stop competing with each other. */
export function DossierSection({ id, number, eyebrow, title, intro, children }: {
  id: string; number: number; eyebrow: string; title: string; intro?: string; children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id + "-title"} className="ink hard scroll-mt-36 rounded-[20px] bg-white">
      <header className="border-b-2 border-[#111214] px-6 py-5 sm:px-8">
        <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#2b31d8]">
          <span className="font-mono">{String(number).padStart(2, "0")}</span> · {eyebrow}
        </p>
        <h2 id={id + "-title"} className="mt-2 text-balance text-[clamp(1.5rem,2.6vw,2rem)] font-extrabold leading-[1.05] tracking-[-.04em] text-[#111214]">{title}</h2>
        {intro && <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#4a4d56]">{intro}</p>}
      </header>
      <div className="space-y-5 px-6 py-6 sm:px-8">{children}</div>
    </section>
  );
}
