import type { ReactNode } from "react";
import { Frame, PageHero, Pill, Section, UI } from "@/components/intelligence/research-ui";

// The shared frame for the legal pages: a compact hero (eyebrow, one h1, the "updated" line as the
// hero note), one narrow white frame of divided sections, and the row of related legal pages.
// The copy is the caller's and renders verbatim; this file only owns the structure and classes.
// Contact and us-regulations compose the same pieces around their own markup.

export const LEGAL_LINKS = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/disclaimer", label: "Disclaimer" },
] as const;

/** The one framed column every legal page uses: divided entries, no outer padding of its own. */
export function LegalFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <Frame pad="none" className={"divide-y divide-[#111214]/10 px-6 sm:px-9 " + className}>{children}</Frame>;
}

/** One divided entry: a heading and its paragraphs. `as` picks the heading level; the look is the same. */
export function LegalSection({ heading, as: Heading = "h2", children }: { heading: string; as?: "h2" | "h3"; children: ReactNode }) {
  return (
    <section className="py-7">
      <Heading className={UI.h3}>{heading}</Heading>
      <div className={UI.bodyInk + " mt-3 max-w-3xl space-y-3 leading-7"}>{children}</div>
    </section>
  );
}

/** The related legal pages that close every legal page, as ghost pills so each is a 36px target. */
export function LegalLinks({ items = LEGAL_LINKS, className = "mt-8" }: { items?: readonly { href: string; label: string }[]; className?: string }) {
  return (
    <div className={"flex flex-wrap gap-3 " + className}>
      {items.map(({ href, label }) => <Pill key={href} href={href} variant="ghost" size="sm">{label}</Pill>)}
    </div>
  );
}

export function LegalPage({ eyebrow, title, updated, sections }: { eyebrow: string; title: string; updated: string; sections: Array<[string, string]> }) {
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["coa"]} eyebrow={eyebrow} title={title} note={updated} />
      <Section narrow tight>
        <LegalFrame>
          {sections.map(([heading, text]) => <LegalSection key={heading} heading={heading}><p>{text}</p></LegalSection>)}
        </LegalFrame>
        <LegalLinks />
      </Section>
    </div>
  );
}
