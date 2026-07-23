import Link from "next/link";
import { Landmark } from "lucide-react";
import reference from "../../scripts/data/reference-manufacturers.json";

// For compounds that ARE an FDA-approved innovator drug (semaglutide, tirzepatide), name the true
// originator and draw the honest line: grey-market material under the same chemical name is NOT that
// company's approved product. Defamation-safe — it states a fact about the innovator, not the vendor.
const INNOVATOR: Record<string, { name: string; drugs: string }> = {
  "novo-nordisk": { name: "Novo Nordisk", drugs: "Ozempic, Wegovy, Rybelsus" },
  "eli-lilly": { name: "Eli Lilly", drugs: "Mounjaro, Zepbound" },
};

export function InnovatorNote({ slug, compoundName }: { slug: string; compoundName: string }) {
  const innovators = reference.innovators as Record<string, string>;
  const key = innovators[slug];
  if (!key) return null;
  const inn = INNOVATOR[key];
  if (!inn) return null;
  return (
    <div className="rounded-[24px] border border-black/[.08] bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-black/[.045]"><Landmark className="size-4 text-black/50" /></span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--muted)]">Reference source</p>
          <p className="mt-1.5 text-sm leading-6 text-black/75">
            {compoundName} is the active ingredient in FDA-approved medicines made by <span className="font-semibold text-black">{inn.name}</span> ({inn.drugs}). Grey-market &ldquo;{compoundName}&rdquo; sold for research is <span className="font-semibold text-black">not {inn.name}&rsquo;s product</span> and is not the FDA-approved drug — a different, unregulated supply chain under the same chemical name.{" "}
            <Link href="/reference-standard" className="font-semibold text-black underline underline-offset-2">See what pharmaceutical-grade means →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
