import { WifiOff, ExternalLink, ServerCrash } from "lucide-react";
import type { VendorStatus } from "@/server/verify/vendor-status";
import { Chip, Frame, UI } from "@/components/intelligence/research-ui";

// Danger for the states a storefront does not come back from on its own; warn for a redirect,
// which is a change of address until something says otherwise.
const ALERT: Record<string, { tone: "danger" | "warn"; icon: typeof WifiOff; label: string }> = {
  offline: { tone: "danger", icon: WifiOff, label: "Site offline" },
  parked: { tone: "danger", icon: ServerCrash, label: "Parked / empty page" },
  closed: { tone: "danger", icon: WifiOff, label: "Reported closed" },
  redirected: { tone: "warn", icon: ExternalLink, label: "Redirects elsewhere" },
};

// Loud only for the going-dark states — a storefront that's offline, parked, or now redirecting
// is the classic end of an exit scam. "operating" and "blocked" don't warrant a banner.
export function VendorStatusBanner({ status, vendorName }: { status: VendorStatus; vendorName: string }) {
  const a = ALERT[status.status];
  if (!a) return null;
  return (
    <Frame tone={a.tone} shadow="sm" radius="rounded-[16px]">
      <Chip tone={a.tone} icon={a.icon}>{status.status === "closed" ? "Vendor status · storefront closed" : "Vendor status · requires further verification"}</Chip>
      {/* h3: nested under the vendor page's alert-group h2. */}
      <h3 className={UI.h3 + " mt-3"}>{vendorName}&rsquo;s storefront isn&rsquo;t operating normally</h3>
      <p className={UI.bodyInk + " mt-3"}><span className="font-extrabold">{a.label}.</span> {status.detail}</p>
      <p className={UI.small + " mt-3"}>A storefront may become unavailable or redirect for many reasons. This observation does not establish fraud, misconduct, closure, or the cause of a technical issue. Checked {status.checkedAt ? new Date(status.checkedAt).toLocaleDateString() : "recently"}; a site can also just be temporarily down.</p>
    </Frame>
  );
}
