import { ArrowUpRight, CalendarClock, CreditCard, Info, MapPin, ShieldQuestion, Truck } from "lucide-react";
import type { VendorSignals } from "@/server/external/repository";
import { Chip, NumberedSection, Quiet, UI } from "@/components/intelligence/research-ui";

// Operational / legitimacy signals read from the vendor's OWN public site (payment rails, how old the
// domain is, whether they post a research-use disclaimer). These are observations, not accusations —
// each is neutral market context a careful buyer would want, with the honest caveat that none of it
// proves product quality. Rendered only outside the evidence-only release; `number` is the section's
// place in the report, handed down by the page so the frame and the jump-nav agree.
const ALT_RAILS = new Set(["crypto", "zelle", "venmo", "cashapp", "bitcoin", "btc", "ach", "gift-certificate"]);
const RAIL_LABEL: Record<string, string> = { card: "Card", crypto: "Crypto", zelle: "Zelle", venmo: "Venmo", cashapp: "Cash App", ach: "ACH", applepay: "Apple Pay", googlepay: "Google Pay", bitcoin: "Bitcoin" };

export function VendorSignalsPanel({ signals, vendorName, number }: { signals: VendorSignals; vendorName: string; number: number }) {
  const methods = Array.isArray(signals.payment_methods) ? (signals.payment_methods as string[]) : [];
  const youngDomain = /~?\s*(7 months|1\.\d|2\.\d)\s*yr|months old|VERY YOUNG|YOUNG/i.test(signals.domain_age_note ?? "");
  const disclaimer = signals.research_disclaimer;
  return (
    <NumberedSection id="signals" number={number} eyebrow="Operational signals" title={<>What does {vendorName}&rsquo;s own storefront tell us?</>}
      intro={<>Neutral operational facts we read directly from {vendorName}&rsquo;s public site and domain records. Context for judgment, not a verdict — none of it proves what&rsquo;s in the vial.</>}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                return <Chip key={m} tone={alt ? "warn" : "white"} plain>{RAIL_LABEL[m.toLowerCase()] ?? m}</Chip>;
              })}
            </span>
            {methods.some((m) => ALT_RAILS.has(m.toLowerCase())) && <span className={UI.small + " mt-2 block"}>Alternative rails (crypto/Zelle/etc.) are common where card processors won&rsquo;t serve research chemicals — a context signal, not a fault.</span>}
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
        <p className={UI.small}>Read from <a href={signals.source_url} target="_blank" rel="noopener noreferrer nofollow" className={UI.linkSmall}>{new URL(signals.source_url).hostname} <ArrowUpRight className="size-3.5" aria-hidden="true" /></a>. Domain age from public WHOIS records.</p>
      )}
    </NumberedSection>
  );
}

// A warn tile is the kit's warn tint behind the same thin panel; a plain one is the quiet inner panel.
function SignalTile({ icon: Icon, label, tone = "plain", children }: { icon: React.ComponentType<{ className?: string }>; label: string; tone?: "plain" | "warn"; children: React.ReactNode }) {
  const head = (
    <div className="flex items-center gap-2">
      <Icon className={`size-4 ${tone === "warn" ? "text-[#9b6b22]" : "text-[#2b31d8]"}`} aria-hidden="true" />
      <p className={UI.eyebrowMuted}>{label}</p>
    </div>
  );
  if (tone === "warn") {
    return (
      <div className="ink-1 rounded-[14px] bg-[#fff3d8] p-4">
        {head}
        <div className={UI.bodyInk + " mt-3"}>{children}</div>
      </div>
    );
  }
  return (
    <Quiet>
      {head}
      <div className={UI.bodyInk + " mt-3"}>{children}</div>
    </Quiet>
  );
}
