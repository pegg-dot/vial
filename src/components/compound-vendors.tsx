import { Factory } from "lucide-react";
import { Chip, NumberedSection, Pill, Quiet, UI } from "@/components/intelligence/research-ui";
import { VendorMark } from "@/components/vendor-mark";
import { VialGradeMark } from "@/components/vial-grade-card";
import { VENDOR_LINK_NOTE } from "@/lib/vendor-source-link";
import type { VendorDirectoryEntry } from "@/lib/vendor-ranking";

/** One directory vendor as it relates to one compound: it lists the compound, has evidence naming it, or both. */
export type CompoundVendorEntry = {
  entry: VendorDirectoryEntry;
  /** The vendor's catalog lists this compound (a listing exists; says nothing about stock or price). */
  lists: boolean;
  /** Independent certificates on file for THIS compound that name this vendor (the page's own list). */
  tests: number;
  /** Batch records on file for THIS compound that belong to this vendor (the page's own list). */
  batches: number;
};

/** The one sentence under a vendor's name: what ties it to the compound, and the evidence for this compound. */
export function compoundVendorLine({ lists, tests, batches }: CompoundVendorEntry, compoundName: string): string {
  const tie = lists ? `Lists ${compoundName}` : `Evidence names ${compoundName}`;
  if (!tests && !batches) return `${tie} · no independent evidence for ${compoundName} on file`;
  const parts = [];
  if (tests) parts.push(`${tests} independent ${tests === 1 ? "test" : "tests"}`);
  if (batches) parts.push(`${batches} batch ${batches === 1 ? "record" : "records"}`);
  return `${tie} · ${parts.join(" · ")} for ${compoundName}`;
}

/**
 * The vendors a compound page can send a reader to: every directory vendor that lists the compound
 * or whose independent certificates or batch records name it, each with the letter from its own
 * record, the way to that record, and the vendor's own website when the vendor-link release allows
 * it for that verdict (the server sets `websiteUrl`). The evidence counts are this compound's own
 * lists (the same ones the hero card counts), never a vendor-wide total from another query, so the
 * two cannot disagree. No prices, no stock, no ranking of its own: the order is the directory's.
 */
export function CompoundVendors({ vendors, compoundName, number, id = "vendors" }: {
  vendors: readonly CompoundVendorEntry[]; compoundName: string; number: number; id?: string;
}) {
  const anyLink = vendors.some(({ entry }) => entry.websiteUrl);
  return (
    <NumberedSection id={id} number={number} eyebrow="Vendors" title={`Who carries ${compoundName}, and what each record shows`}
      intro="Every directory vendor that lists this compound or has independent evidence naming it. A letter summarises the evidence on the vendor's own record; it is not a recommendation of any seller, and VialGrade sells nothing and takes no referrals.">
      <ul className="grid gap-3 md:grid-cols-2">
        {vendors.map((row) => {
          const { entry: { vendor: v, websiteUrl } } = row;
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
                <p className={UI.small + " mt-1"}>{compoundVendorLine(row, compoundName)}</p>
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
