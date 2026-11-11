import { BadgeCheck, ClipboardList } from "lucide-react";
import { ResearchWorkpaperActions } from "@/components/intelligence/research-workpaper-actions";
import { PexEvidenceClaimGrid, PexEvidenceScopeStrip } from "@/components/intelligence/pexiganan-evidence";
import { Frame, Notice, Quiet, UI } from "@/components/intelligence/research-ui";
import {
  PEXIGANAN_NETWORK_VERSION, PEXIGANAN_REVIEW_DATE, PEXIGANAN_SOURCES, PEXIGANAN_TRIAL_SELECTION, pexEvidencePassportMarkdown,
} from "@/lib/pexiganan-evidence-network";

// The evidence passport used to be a page of its own (/intelligence/passports/pexiganan). It is the
// Studies section of the pexiganan compound page now: the plain-language answer first, then the six
// checks, then the registry rows the page already re-reads live. Counts come from the register
// itself, so the copy cannot drift from the records.
const SOURCE_COUNT = PEXIGANAN_SOURCES.length;
const COMPOUND_COUNT = PEXIGANAN_SOURCES.filter(source => source.kind === "compound").length;
const REGISTRY_COUNT = PEXIGANAN_SOURCES.filter(source => source.kind === "registry").length;
const PUBMED_COUNT = SOURCE_COUNT - COMPOUND_COUNT - REGISTRY_COUNT;
export const PEX_PINNED_TRIALS = PEXIGANAN_TRIAL_SELECTION.length;

/** The sentence over the live registry table: how many rows, and why a row can stay unverified. */
export const PEX_REGISTRY_NOTE = PEX_PINNED_TRIALS + " pinned NCT records are fetched live from ClinicalTrials.gov and matched on their intervention field. A row that cannot be reconfirmed stays unverified rather than inheriting the editorial snapshot.";

/** The sentence over the source register: what the records are, and that each one links to the verifier. */
export const PEX_REGISTER_NOTE = SOURCE_COUNT + " original records: " + COMPOUND_COUNT + " PubChem identities, " + REGISTRY_COUNT + " registry entries and " + PUBMED_COUNT + " PubMed items. Each links to the verifier, which reports the record and its limitation.";

export function PexEvidencePassport() {
  return (
    <div className="grid gap-4">
      <Frame as="section" ariaLabel="Passport summary in plain language" tone="mint" pad="lg" className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <div>
          <p className={UI.eyebrow + " flex items-center gap-2"}><ClipboardList className="size-4" aria-hidden="true" /> Evidence passport · {PEXIGANAN_NETWORK_VERSION}</p>
          <h3 className={UI.h3 + " mt-3"}>What can we actually say?</h3>
          <p className={UI.bodyInk + " mt-4 max-w-3xl leading-7"}>
            Pexiganan and Magainin 2 have separate molecular identities. Selected study registrations and papers can
            be traced back to their source records. That does not establish a clinical benefit, an exact trial-to-paper
            outcome match, or the authenticity of any physical sample.
          </p>
          <p className={UI.small + " mt-3"}>Editorial source check {PEXIGANAN_REVIEW_DATE} · a selected-source review, not a scientific verdict. Read the six individual evidence checks below to see which link is supported and where questions remain.</p>
          <div className="mt-4"><PexEvidenceScopeStrip /></div>
        </div>
        <div className="grid gap-3">
          <Notice tone="blue" icon={BadgeCheck} title="The bottom line">
            <p className="text-xs leading-5">Source relationships, not a scientific verdict. A reported registry result is not a benefit finding. A DERIVED review is not a clinical primary outcome paper.</p>
          </Notice>
          <Quiet>
            <p className="text-sm font-extrabold text-[#111214]">Save the source trail</p>
            <p className={UI.small + " mt-1"}>Export all checked claims, sources and limitations without an account.</p>
            <div className="mt-3"><ResearchWorkpaperActions markdown={pexEvidencePassportMarkdown()} filename="vialgrade-pexiganan-evidence-passport.md" /></div>
          </Quiet>
        </div>
      </Frame>

      <div id="passport-claims" className="scroll-mt-36">
        <p className={UI.eyebrowMuted}>Evidence checks</p>
        <h3 className={UI.h3 + " mt-1"}>Six observations, each tied to its original record</h3>
        <p className={UI.small + " mt-2 max-w-3xl"}>Every card names the records it rests on, what they show, and what they do not prove. The status chip says whether a fact is read from one source field, connected across two sources, or still needs a reviewer.</p>
        <div className="mt-4"><PexEvidenceClaimGrid headless /></div>
      </div>
    </div>
  );
}
