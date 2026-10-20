import { PexTrialNetworkTable } from "@/components/intelligence/pexiganan-evidence";
import { getPexigananTrialEvidence } from "@/server/intelligence/pexiganan-network";

export async function PexTrialNetworkLive() {
  const rows = await getPexigananTrialEvidence();
  return <PexTrialNetworkTable rows={rows} />;
}

export function PexTrialNetworkLoading() {
  return (
    <section id="pexiganan-trials-loading" aria-label="Pexiganan selected original trial records"
      className="scroll-mt-36 rounded-2xl border-2 border-[#17191b] bg-white p-6">
      <p className="text-sm font-bold text-[#3b6554]">Checking four selected NCT study records…</p>
      <p className="mt-2 text-xs leading-5 text-[#728278]">If an official source is unavailable, its status will stay unverified instead of showing a fabricated result.</p>
    </section>
  );
}
