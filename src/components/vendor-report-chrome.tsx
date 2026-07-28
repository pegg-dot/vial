"use client";

import { useEffect, useState } from "react";

// Consistent hardened section header used across the vendor report.
export function SectionHead({ eyebrow, title, note }: { eyebrow: string; title: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">{eyebrow}</p>
        <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold leading-[.98] tracking-[-.04em]">{title}</h2>
      </div>
      {note && <span className="ink-1 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[var(--muted)]">{note}</span>}
    </div>
  );
}

// Sticky sub-nav for the long report — jumps to a section and highlights the one you're in.
export function JumpNav({ items }: { items: Array<{ id: string; label: string }> }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  useEffect(() => {
    const els = items.map((it) => document.getElementById(it.id)).filter((e): e is HTMLElement => Boolean(e));
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [items]);

  return (
    <div className="sticky top-[71px] z-30 border-y-2 border-[#111214] bg-[rgba(247,247,244,.9)] backdrop-blur">
      <div className="mx-auto max-w-[1320px] overflow-x-auto px-5 no-scrollbar sm:px-8">
        <div className="flex gap-1 py-2.5">
          {items.map((it) => (
            <a
              key={it.id}
              href={`#${it.id}`}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold transition ${active === it.id ? "bg-[#111214] text-white" : "text-[#111214]/55 hover:bg-[#111214]/[.06] hover:text-[#111214]"}`}
            >
              {it.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
