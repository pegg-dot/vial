import type { ReactNode } from "react";
import { NumberedSection, StickyContents, type ContentsItem } from "@/components/intelligence/research-ui";

export type DossierTocItem = ContentsItem;

/** The dossier's contents list: the shared sticky contents with the dossier's own label. */
export function DossierToc({ items }: { items: readonly DossierTocItem[] }) {
  return <StickyContents items={items} label="Research dossier sections" />;
}

/** The dossier's section frame is the shared numbered section. Kept under its old name so the dossier page and its tests read the same. */
export function DossierSection(props: {
  id: string; number: number; eyebrow: string; title: string; intro?: string; className?: string; children: ReactNode;
}) {
  return <NumberedSection {...props} />;
}
