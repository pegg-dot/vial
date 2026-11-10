import { PexTrialNetworkTable } from "@/components/intelligence/pexiganan-evidence";
import { UI } from "@/components/intelligence/research-ui";
import { getPexigananTrialEvidence } from "@/server/intelligence/pexiganan-network";

export async function PexTrialNetworkLive() {
  const rows = await getPexigananTrialEvidence();
  return <PexTrialNetworkTable rows={rows} />;
}

/** Streamed fallback; keeps its own id so the page never carries two `pexiganan-trials`. */
export function PexTrialNetworkLoading() {
  return (
    <section id="pexiganan-trials-loading" aria-label="Pexiganan selected original trial records"
      className="scroll-mt-36 rounded-[14px] border border-[#111214]/15 bg-white px-5 py-5">
      <p className="text-sm font-extrabold text-[#111214]">Checking four selected NCT study records…</p>
      <p className={UI.small + " mt-2"}>If an official source is unavailable, its status will stay unverified instead of showing a fabricated result.</p>
    </section>
  );
}
