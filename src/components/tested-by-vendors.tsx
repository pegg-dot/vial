import { Factory } from "lucide-react";
import { Chip, NumberedSection, Pill, Quiet, UI } from "@/components/intelligence/research-ui";
import { VendorMark } from "@/components/vendor-mark";
import { VialGradeMark } from "@/components/vial-grade-card";
import { VENDOR_LINK_NOTE } from "@/lib/vendor-source-link";
import type { VendorDirectoryEntry } from "@/lib/vendor-ranking";

/**
 * The vendors whose independent certificates or batch records name a compound, each with the
 * letter from its own record and the way to it. The storefront link appears only when the entry
 * carries `websiteUrl`, which the server sets under the vendor-link release for allowed verdicts.
 * No prices, no stock, no ranking: the order is the directory's.
 */
export function TestedByVendors({ entries, compoundName, number, id = "tested-by" }: {
  entries: readonly VendorDirectoryEntry[]; compoundName: string; number: number; id?: string;
}) {
  const anyLink = entries.some((entry) => entry.websiteUrl);
  return (
    <NumberedSection id={id} number={number} eyebrow="Vendors with evidence" title={`Who has lab evidence for ${compoundName}`}
      intro="Vendors whose independent certificates or batch records name this compound. A letter summarises the evidence on a vendor's own record; it is not a recommendation of any seller.">
      <ul className="grid gap-3 md:grid-cols-2">
        {entries.map(({ vendor: v, websiteUrl }) => {
          const graded = Boolean(v.grade?.letter) && v.grade?.band !== "reference";
          return (
            <Quiet as="li" key={v.slug} className="flex flex-wrap items-center gap-3">
              <VendorMark initials={v.initials} accent={v.accent} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={UI.h4 + " truncate"}>{v.name}</h3>
                  {v.kind === "manufacturer" && <Chip tone="ink" icon={Factory}>Maker</Chip>}
                  {graded ? <VialGradeMark grade={v.grade!} vendorName={v.name} /> : <Chip tone="paper">Not rated</Chip>}
                </div>
                <p className={UI.small + " mt-1"}>
                  {v.coaCount} independent {v.coaCount === 1 ? "test" : "tests"} · {v.passportCount} batch {v.passportCount === 1 ? "record" : "records"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill href={"/vendors/" + v.slug} variant="ghost" size="sm" arrow="right" ariaLabel={v.name + " vendor record"}>Vendor record</Pill>
                {websiteUrl && (
                  <Pill href={websiteUrl} external rel="noopener noreferrer nofollow" variant="ghost" size="sm" arrow="up"
                    ariaLabel={v.name + " website, external"} title={VENDOR_LINK_NOTE}>Website</Pill>
                )}
              </div>
            </Quiet>
          );
        })}
      </ul>
      {anyLink && <p className={UI.small}>{VENDOR_LINK_NOTE}</p>}
    </NumberedSection>
  );
}
