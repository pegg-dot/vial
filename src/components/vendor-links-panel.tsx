import Link from "next/link";
import { ArrowRight, GitMerge } from "lucide-react";
import type { VendorLink } from "@/server/verify/vendor-linkage";
import { Chip, Frame, NumberedSection, Pill, TONE_ACCENT, UI } from "@/components/intelligence/research-ui";

const vendorName = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// The operator-network view: which "independent" storefronts are actually one operator (shared
// analytics/pixel or the same tested batch) or one source (same upstream maker). This is the
// thing a buyer can't see on a single site — so it's shown loudest when it's strongest. `number` is
// the section's place in the report, handed down by the page so the frame and the jump-nav agree.
export function VendorLinksPanel({ links, vendorName: name, number }: { links: VendorLink[]; vendorName: string; number: number }) {
  const strong = links.filter((l) => l.strength === "strong");
  const info = links.filter((l) => l.strength === "info");

  return (
    <NumberedSection id="network" number={number} eyebrow="Who owns it" title={<>Who&rsquo;s really behind {name}?</>}
      intro={strong.length > 0
        ? `${name} shares hard identifiers with ${strong.length} other storefront${strong.length === 1 ? "" : "s"} we track — which may warrant further investigation. Shared technology does not establish common ownership.`
        : `We found no hard identifier tying ${name} to any other storefront we track.`}>
      {strong.length > 0 ? (
        <Frame tone="warn" thin shadow="none" radius="rounded-[14px]" pad="sm">
          <Chip tone="warn" icon={GitMerge}>Linked to {strong.length} other storefront{strong.length === 1 ? "" : "s"}</Chip>
          <p className={UI.bodyInk + " mt-3"}>{name} has overlapping publicly observed technical or document identifiers with other storefronts. A shared code, image, or batch reference can arise from common services, templates or suppliers and does not establish common ownership, product equivalence, or wrongdoing.</p>
          <ul className="mt-4 space-y-3">
            {strong.map((l) => (
              <li key={`${l.basis}-${l.linkedSlug}`} className="flex items-start gap-3">
                <span className="mt-2 size-2 shrink-0 rounded-full bg-[#9b6b22]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <Link href={`/vendors/${l.linkedSlug}`} className={UI.link}>{vendorName(l.linkedSlug)} <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
                  <p className={UI.small + " mt-0.5"}>{l.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Frame>
      ) : (
        <Frame tone="mint" thin shadow="none" radius="rounded-[14px]" pad="sm">
          <p className={"text-sm font-extrabold " + TONE_ACCENT.mint}>Not linked to any other store we track</p>
          <p className={UI.bodyInk + " mt-2"}>We checked {name} against every other store we track for the tell-tale signs that two &ldquo;different&rdquo; shops are the same people: the same tracking code, the same product photo, the same tested batch, the same supplier. No match was found in the records examined. This does not establish independence, good standing, or product quality.</p>
        </Frame>
      )}

      {info.length > 0 ? (
        <Frame tone="blue" thin shadow="none" radius="rounded-[14px]" pad="sm">
          <p className={UI.eyebrow}>Same supplier</p>
          <p className={UI.bodyInk + " mt-2"}>These stores&rsquo; lab reports name the same maker as {name}&rsquo;s do. A manufacturer named in two reports does not establish that sellers carry identical substances, shipments or samples.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {info.map((l) => (
              <Pill key={`src-${l.linkedSlug}`} href={`/vendors/${l.linkedSlug}`} variant="ghost" size="sm" arrow="right">{vendorName(l.linkedSlug)}</Pill>
            ))}
          </div>
        </Frame>
      ) : null}
    </NumberedSection>
  );
}
