import Link from "next/link";
import { FlaskConical } from "lucide-react";

// A visible research boundary, not an attestation or legal safe harbor.
// No event or acknowledgement is collected.
export function DisclosureBanner({ hasDemo = false }: { hasDemo?: boolean }) {
  return (
    <div className="border-b border-black/[.08] bg-white/70">
      <div className="mx-auto flex min-h-10 max-w-[1320px] items-center justify-center gap-2 px-5 py-2 text-center text-[11px] font-medium leading-5 text-[var(--muted)] sm:px-8">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden="true" />
        <p>
          {hasDemo ? "Some records are illustrative; others summarize public sources." : "Records summarize public sources; they are not independently guaranteed."}
          {" "}No sales or seller referrals. “Research use only” is not a drug-law exemption.{" "}
          <Link href="/legal/us-regulations" className="font-bold text-[#2b31d8] underline underline-offset-2">Read the limits</Link>.
        </p>
      </div>
    </div>
  );
}
