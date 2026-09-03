import { WifiOff, ExternalLink, ServerCrash } from "lucide-react";
import type { VendorStatus } from "@/server/verify/vendor-status";

const ALERT: Record<string, { ring: string; bg: string; chip: string; icon: typeof WifiOff; label: string }> = {
  offline: { ring: "border-[#111214]", bg: "bg-[#ffecea]", chip: "bg-white text-[#d3372c]", icon: WifiOff, label: "Site offline" },
  parked: { ring: "border-[#111214]", bg: "bg-[#ffecea]", chip: "bg-white text-[#d3372c]", icon: ServerCrash, label: "Parked / empty page" },
  closed: { ring: "border-[#111214]", bg: "bg-[#ffecea]", chip: "bg-white text-[#d3372c]", icon: WifiOff, label: "Permanently closed" },
  redirected: { ring: "border-[#111214]", bg: "bg-[#fff6e6]", chip: "bg-white text-[#b26a00]", icon: ExternalLink, label: "Redirects elsewhere" },
};

// Loud only for the going-dark states — a storefront that's offline, parked, or now redirecting
// is the classic end of an exit scam. "operating" and "blocked" don't warrant a banner.
export function VendorStatusBanner({ status, vendorName }: { status: VendorStatus; vendorName: string }) {
  const a = ALERT[status.status];
  if (!a) return null;
  const Icon = a.icon;
  return (
    <div className={`hard-sm rounded-[16px] border-2 p-6 ${a.ring} ${a.bg}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid size-9 place-items-center rounded-xl ${a.chip}`}><Icon className="size-4" /></span>
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[.16em] ${status.status === "redirected" ? "text-[#b26a00]" : "text-[#d3372c]"}`}>{status.status === "closed" ? "Vendor status · storefront closed" : "Vendor status · possible exit scam"}</p>
          {/* h3: nested under the vendor page's alert-group h2. */}
          <h3 className="mt-1 text-lg font-semibold tracking-[-.025em]">{vendorName}&rsquo;s storefront isn&rsquo;t operating normally</h3>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-black/70"><span className="font-semibold">{a.label}.</span> {status.detail}</p>
      <p className="mt-3 text-[11px] leading-4 text-black/45">A dark or redirected storefront is the classic end state of an exit scam — sites vanish while orders and money don&rsquo;t arrive. Checked {status.checkedAt ? new Date(status.checkedAt).toLocaleDateString() : "recently"}; a site can also just be temporarily down.</p>
    </div>
  );
}
