import { NextResponse } from "next/server";
import { requireApiKey } from "@/server/api-access/bearer";
import { getLabsOverview } from "@/server/labs/repository";

export const dynamic = "force-dynamic";

// Public lab-intelligence standard: every testing lab VialGrade references, with what we could verify
// about it. `independence` is the load-bearing field — only "independent" labs are ones VialGrade
// vouches for as third-party corroboration; "independence-unverified" and "unverified" are shown
// for transparency but never counted. Accreditation carries its verification status and whether
// the accredited scope covers peptides. Never an endorsement.
export async function GET(request: Request) {
  const auth = await requireApiKey(request, "labs:read");
  if (auth.response) return auth.response;
  const labs = await getLabsOverview();
  const data = labs.map(({ profile: l, usage }) => ({
    slug: l.slug,
    displayName: l.displayName,
    exists: l.exists,
    independence: l.independence,
    countsAsIndependentEvidence: l.independence === "independent",
    independenceNote: l.independence === "independent" ? null : l.independentNote ?? null,
    legalName: l.legalName,
    country: l.country,
    website: l.website,
    accreditation: {
      iso17025: l.accreditation.iso17025,
      standard: l.accreditation.standard,
      body: l.accreditation.body,
      number: l.accreditation.number,
      status: l.accreditation.status,
      scopeCoversPeptides: l.accreditation.scopeCoversPeptides,
      note: l.accreditation.note,
    },
    techniques: l.techniques,
    doesNotTestByDefault: l.doesNotTestByDefault,
    verifyPortal: l.verifyPortal,
    usage: { certificates: usage.coaCount, vendors: usage.vendorCount, medianPurity: usage.purityMedian },
    sourceUrls: l.sourceUrls,
  }));
  return NextResponse.json(
    { data, meta: { standard: "vial-labs", version: "v1", readonly: true, note: "independence is what VialGrade vouches for; accreditation is only meaningful within its verified scope. Not an endorsement." } },
    { headers: { "cache-control": "no-store" } },
  );
}
