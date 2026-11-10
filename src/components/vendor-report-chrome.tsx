"use client";

import { useEffect, useState } from "react";

// Sticky sub-nav for the long report — jumps to a section and highlights the one you're in. The
// chips carry the same numbers as the section frames (both read one ordered list on the page), so
// the bar is the kit's sticky contents laid flat. `identity` keeps the vendor's name + grade letter
// on screen for the whole read once the header has scrolled away.
export function JumpNav({ items, identity }: { items: Array<{ id: string; label: string }>; identity?: { name: string; letter: string | null } }) {
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
    // No margin of its own: the section band above it supplies the gap, so whatever precedes the
    // bar (the verdict, or the alert group when a vendor has one) ends the same distance from it.
    // Once the bar sticks, `top` governs — 71px is the site header.
    <nav aria-label="Report sections" className="sticky top-[71px] z-30 border-y-2 border-[#111214] bg-[rgba(247,247,244,.96)] backdrop-blur-md">
      <div className="mx-auto max-w-[1320px] overflow-x-auto px-5 no-scrollbar sm:px-8">
        <div className="flex items-center gap-1 py-1.5">
          {identity && (
            <span className="mr-2 hidden shrink-0 items-center gap-1.5 sm:inline-flex">
              <span className="max-w-[180px] truncate text-sm font-extrabold tracking-[-.02em] text-[#111214]">{identity.name}</span>
              {identity.letter && <span className="ink-1 rounded-[6px] bg-white px-1.5 py-0.5 text-[11px] font-extrabold text-[#111214]">{identity.letter}</span>}
            </span>
          )}
          {items.map((it, index) => (
            <a
              key={it.id}
              href={`#${it.id}`}
              className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-bold transition ${active === it.id ? "bg-[#111214] text-white" : "text-[#3a3d46] hover:bg-black/[.06] hover:text-[#111214]"}`}
            >
              <span aria-hidden="true" className={`font-mono text-[11px] ${active === it.id ? "text-white/70" : "text-[#2b31d8]"}`}>{String(index + 1).padStart(2, "0")}</span>
              <span className="whitespace-nowrap">{it.label}</span>
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
