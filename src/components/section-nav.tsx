"use client";
import { useEffect, useState } from "react";
import { UI } from "@/components/intelligence/research-ui";

// The "don't get lost" bar: a sticky in-page map of the compound page's sections, pinned just
// below the 72px site header. Anchor links (not tabs) so every section stays in the document —
// crawlable, linkable, findable with cmd-F. A scrollspy highlights the section in view.
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Consider a section "current" while it occupies the reading band under the sticky chrome.
      { rootMargin: "-140px 0px -55% 0px" },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;
  return (
    <nav aria-label="On this page" className="sticky top-[72px] z-30 border-b-2 border-[#111214] bg-[rgba(247,247,244,.96)] backdrop-blur-md">
      <div className={UI.container + " flex items-center gap-1 overflow-x-auto py-2"}>
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-[13px] font-bold transition-colors ${
              active === item.id ? "bg-[#111214] text-white" : "text-[#3a3d46] hover:bg-black/[.06] hover:text-[#111214]"
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
