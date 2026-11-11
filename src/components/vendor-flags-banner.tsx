import { ShieldAlert } from "lucide-react";
import type { CoaFlag } from "@/server/verify/coa-integrity";
import { Chip, Frame, UI } from "@/components/intelligence/research-ui";

// The "salvage title" banner. When a vendor's published certificates don't hold up, a buyer
// sees exactly what's wrong — and why it matters — before anything else on the page.
export function VendorFlagsBanner({ flags, vendorName }: { flags: CoaFlag[]; vendorName: string }) {
  if (flags.length === 0) return null;
  const high = flags.some((f) => f.severity === "high");
  const tone = high ? "danger" : "warn";
  return (
    <Frame tone={tone} shadow="sm" radius="rounded-[16px]">
      <Chip tone={tone} icon={ShieldAlert}>Certificate integrity warning</Chip>
      {/* h3: nested under the vendor page's alert-group h2. */}
      <h3 className={UI.h3 + " mt-3"}>{vendorName}&rsquo;s posted lab certificates need additional review</h3>
      <ul className="mt-4 space-y-3">
        {flags.map((f) => (
          <li key={f.kind} className="flex flex-wrap items-start gap-x-3 gap-y-1.5 sm:flex-nowrap">
            <Chip tone={f.severity === "high" ? "danger" : "warn"} plain className="shrink-0">{f.label}</Chip>
            <p className={UI.bodyInk}>{f.detail}</p>
          </li>
        ))}
      </ul>
      <p className={UI.small + " mt-4"}>Derived from the certificates this vendor publishes. A red flag here doesn&rsquo;t mean the product is fake — it means the available documents need additional verification before conclusions are drawn. Not an accusation of intent.</p>
    </Frame>
  );
}
