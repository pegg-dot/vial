import { WifiOff, ExternalLink, ServerCrash } from "lucide-react";
import type { VendorStatus } from "@/server/verify/vendor-status";

const ALERT: Record<string, { ring: string; bg: string; chip: string; icon: typeof WifiOff; label: string }> = {
  offline: { ring: "border-rose-300", bg: "bg-rose-50", chip: "bg-rose-100 text-rose-800", icon: WifiOff, label: "Site offline" },
  parked: { ring: "border-rose-300", bg: "bg-rose-50", chip: "bg-rose-100 text-rose-800", icon: ServerCrash, label: "Parked / empty page" },
  redirected: { ring: "border-amber-300", bg: "bg-amber-50", chip: "bg-amber-100 text-amber-800", icon: ExternalLink, label: "Redirects elsewhere" },
};

// Loud only for the going-dark states — a storefront that's offline, parked, or now redirecting
// is the classic end of an exit scam. "operating" and "blocked" don't warrant a banner.
export function VendorStatusBanner({ status, vendorName }: { status: VendorStatus; vendorName: string }) {
  const a = ALERT[status.status];
  if (!a) return null;
  const Icon = a.icon;
  return (
    <div className={`rounded-[26px] border p-6 ${a.ring} ${a.bg}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid size-9 place-items-center rounded-xl ${a.chip}`}><Icon className="size-4" /></span>
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[.16em] ${status.status === "redirected" ? "text-amber-700" : "text-rose-700"}`}>Vendor status · possible exit scam</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-.025em]">{vendorName}&rsquo;s storefront isn&rsquo;t operating normally</h2>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-black/70"><span className="font-semibold">{a.label}.</span> {status.detail}</p>
      <p className="mt-3 text-[11px] leading-4 text-black/45">A dark or redirected storefront is the classic end state of an exit scam — sites vanish while orders and money don&rsquo;t arrive. Checked {status.checkedAt ? new Date(status.checkedAt).toLocaleDateString() : "recently"}; a site can also just be temporarily down.</p>
    </div>
  );
}
