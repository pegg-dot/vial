import { CalendarClock, CreditCard, Info, MapPin, ShieldQuestion, Truck } from "lucide-react";
import type { VendorSignals } from "@/server/external/repository";

// Operational / legitimacy signals read from the vendor's OWN public site (payment rails, how old the
// domain is, whether they post a research-use disclaimer). These are observations, not accusations —
// each is neutral market context a careful buyer would want, with the honest caveat that none of it
// proves product quality.
const ALT_RAILS = new Set(["crypto", "zelle", "venmo", "cashapp", "bitcoin", "btc", "ach", "gift-certificate"]);
const RAIL_LABEL: Record<string, string> = { card: "Card", crypto: "Crypto", zelle: "Zelle", venmo: "Venmo", cashapp: "Cash App", ach: "ACH", applepay: "Apple Pay", googlepay: "Google Pay", bitcoin: "Bitcoin" };

export function VendorSignalsPanel({ signals, vendorName }: { signals: VendorSignals; vendorName: string }) {
  const methods = Array.isArray(signals.payment_methods) ? (signals.payment_methods as string[]) : [];
  const youngDomain = /~?\s*(7 months|1\.\d|2\.\d)\s*yr|months old|VERY YOUNG|YOUNG/i.test(signals.domain_age_note ?? "");
  const disclaimer = signals.research_disclaimer;
  return (
    <section className="mx-auto max-w-[1320px] px-5 pt-14 sm:px-8 sm:pt-16">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Operational signals</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">What their own storefront tells us</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Neutral operational facts we read directly from {vendorName}&rsquo;s public site and domain records. Context for judgment, not a verdict — none of it proves what&rsquo;s in the vial.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {signals.domain_age_note && (
          <SignalTile icon={CalendarClock} label="Domain age" tone={youngDomain ? "warn" : "plain"}>
            {signals.domain_age_note}
          </SignalTile>
        )}
        {methods.length > 0 && (
          <SignalTile icon={CreditCard} label="Payment methods">
            <span className="flex flex-wrap gap-1.5">
              {methods.map((m) => {
                const alt = ALT_RAILS.has(m.toLowerCase());
                return <span key={m} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${alt ? "bg-amber-50 text-amber-800" : "bg-black/[.05] text-black/60"}`}>{RAIL_LABEL[m.toLowerCase()] ?? m}</span>;
              })}
            </span>
            {methods.some((m) => ALT_RAILS.has(m.toLowerCase())) && <span className="mt-2 block text-[11px] leading-4 text-[var(--muted)]">Alternative rails (crypto/Zelle/etc.) are common where card processors won&rsquo;t serve research chemicals — a context signal, not a fault.</span>}
          </SignalTile>
        )}
        {disclaimer != null && (
          <SignalTile icon={ShieldQuestion} label="Research-use disclaimer" tone={disclaimer ? "plain" : "warn"}>
            {disclaimer ? "Posts a clear research-use-only / not-for-human-consumption notice." : "No research-use-only disclaimer found on the homepage (its absence is noted, not judged)."}
          </SignalTile>
        )}
        {signals.ships_from && <SignalTile icon={MapPin} label="Ships from">{signals.ships_from}</SignalTile>}
        {signals.guarantees && <SignalTile icon={Truck} label="Stated guarantees">{signals.guarantees}</SignalTile>}
        {signals.notable_copy && (
          <SignalTile icon={Info} label="Worth noting" tone={/RISK|workaround|back online|downtime/i.test(signals.notable_copy) ? "warn" : "plain"}>
            {signals.notable_copy}
          </SignalTile>
        )}
      </div>
      {signals.source_url && (
        <p className="mt-4 text-[11px] text-[var(--muted)]">Read from <a href={signals.source_url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-black/50 underline underline-offset-2 hover:text-black">{new URL(signals.source_url).hostname}</a>. Domain age from public WHOIS records.</p>
      )}
    </section>
  );
}

function SignalTile({ icon: Icon, label, tone = "plain", children }: { icon: React.ComponentType<{ className?: string }>; label: string; tone?: "plain" | "warn"; children: React.ReactNode }) {
  return (
    <div className={`rounded-[24px] border p-5 ${tone === "warn" ? "border-amber-200 bg-amber-50/60" : "border-black/[.07] bg-white"}`}>
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${tone === "warn" ? "text-amber-700" : "text-black/35"}`} />
        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--muted)]">{label}</p>
      </div>
      <div className="mt-3 text-sm leading-6 text-black/75">{children}</div>
    </div>
  );
}
