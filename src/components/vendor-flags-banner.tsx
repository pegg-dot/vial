import { ShieldAlert } from "lucide-react";
import type { CoaFlag } from "@/server/verify/coa-integrity";

// The "salvage title" banner. When a vendor's published certificates don't hold up, a buyer
// sees exactly what's wrong — and why it matters — before anything else on the page.
export function VendorFlagsBanner({ flags, vendorName }: { flags: CoaFlag[]; vendorName: string }) {
  if (flags.length === 0) return null;
  const high = flags.some((f) => f.severity === "high");
  return (
    <div className={`rounded-[26px] border p-6 ${high ? "border-rose-300 bg-rose-50" : "border-amber-300 bg-amber-50"}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid size-9 place-items-center rounded-xl ${high ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}><ShieldAlert className="size-4" /></span>
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[.16em] ${high ? "text-rose-700" : "text-amber-700"}`}>Certificate integrity warning</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-.025em]">{vendorName}&rsquo;s posted lab certificates don&rsquo;t hold up</h2>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {flags.map((f) => (
          <li key={f.kind} className="flex items-start gap-3">
            <span className={`mt-1.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${f.severity === "high" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{f.label}</span>
            <p className="text-sm leading-6 text-black/70">{f.detail}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] leading-4 text-black/45">Derived from the certificates this vendor publishes. A red flag here doesn&rsquo;t mean the product is fake — it means the vendor&rsquo;s proof of testing can&rsquo;t be trusted at face value. Not an accusation of intent.</p>
    </div>
  );
}
