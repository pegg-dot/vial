import Link from "next/link";
import { ArrowRight, Landmark } from "lucide-react";
import { Notice, UI } from "@/components/intelligence/research-ui";
import { hidesCommerce } from "@/lib/public-research-release";
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
  // The pharmaceutical-grade explainer is closed under the evidence-only release; the grading
  // page carries the same distinction there.
  const href = hidesCommerce() ? "/how-we-check#grade-checks" : "/reference-standard";
  return (
    <Notice tone="warn" icon={Landmark} title="Reference source">
      <p className="mt-1">
        {compoundName} is the active ingredient in FDA-approved medicines made by <span className="font-extrabold">{inn.name}</span> ({inn.drugs}). Grey-market &ldquo;{compoundName}&rdquo; sold for research is <span className="font-extrabold">not {inn.name}&rsquo;s product</span> and is not the FDA-approved drug — a different, unregulated supply chain under the same chemical name.
      </p>
      <Link href={href} className={UI.linkSmall + " mt-2"}>See what pharmaceutical-grade means <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
    </Notice>
  );
}
