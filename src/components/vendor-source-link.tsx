import { ArrowUpRight } from "lucide-react";
import { VENDOR_LINK_LABEL, VENDOR_LINK_NOTE } from "@/lib/vendor-source-link";

/** One labeled external link to a company's own site. Not tracked, not routed through /go. */
export function VendorSourceLink({ url }: { url: string }) {
  return (
    <section aria-label="Company website" className="mx-auto mt-5 max-w-[1320px] px-5 sm:px-8">
      <p className="ink-1 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] bg-white px-4 py-3 text-sm font-medium text-[var(--muted)]">
        <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-6 items-center gap-1.5 font-extrabold text-[#2b31d8] underline underline-offset-2">
          {VENDOR_LINK_LABEL}: {new URL(url).hostname} <ArrowUpRight className="size-4" aria-hidden="true" />
        </a>
        <span className="text-xs">{VENDOR_LINK_NOTE}</span>
      </p>
    </section>
  );
}
