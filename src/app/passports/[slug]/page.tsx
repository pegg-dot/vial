import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2, CircleDashed, EyeOff, Fingerprint, ShieldCheck } from "lucide-react";
import { getPublicPassport, verifyCustodyChain } from "@/server/evidence-network/repository";
import type { LivePassportBasis, LivePassportEvidence } from "@/server/evidence-network/live-passports";
import {
  Chip, ContentsLayout, Frame, Notice, NumberedSection, PageHero, Pill, Quiet, Section, Stat, UI, type ContentsItem, type Tone,
} from "@/components/intelligence/research-ui";
export const dynamic = "force-dynamic";

// generateMetadata and the page body both need the passport. React's cache() dedupes them into one
// database read per request — without it, adding metadata would have doubled the query load on
// every batch page, which is the cost pattern that exhausted the database quota once already.
const loadPassport = cache(getPublicPassport);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPassport(slug);
  if (!data) return {};
  const p = data.passport as Record<string, unknown>;
  const batch = String(p.declared_batch_code ?? slug);
  const vendor = p.vendor_name ? String(p.vendor_name) : null;
  const compound = p.product_name || p.compound_name ? String(p.product_name || p.compound_name) : null;
  const subject = [compound, vendor].filter(Boolean).join(" from ");
  return {
    title: `Batch ${batch}${vendor ? ` — ${vendor}` : ""}`,
    description: `Every independent lab report on record for batch ${batch}${subject ? ` (${subject})` : ""}: who picked the sample, what came back, and where results disagree. Not a safety rating.`,
    alternates: { canonical: `/passports/${slug}` },
  };
}
// The stored dimension words, said the way a person would say them.
const DIMENSION_STATUS_WORDS: Record<string, string> = { established: "Checked", conflicting: "Results disagree", unknown: "Not checked" };
// The tone says what kind of fact a dimension's status is: checked (mint), disagreeing (warn), not checked (plain).
const DIMENSION_STATUS_TONE: Record<string, Tone> = { established: "mint", conflicting: "warn" };
// How the sample reached the lab, in words rather than an internal code (S1–S4).
const SAMPLING_WORDS: Record<string, string> = { S1: "Vendor picked the sample", S2: "Customer's sealed unit", S3: "Bought blind, like a customer", S4: "Bought blind, tested repeatedly" };
function obj(v: unknown) {
  if (v && typeof v === "object") return v as Record<string, unknown>;
  try { return JSON.parse(String(v)); } catch { return {}; }
}
function arr(v: unknown) {
  if (Array.isArray(v)) return v;
  try { return JSON.parse(String(v)); } catch { return []; }
}

// The first crumb is the research home; the browse-release spec bans a main link ending in "/market"
// on these pages (the closed per-compound market tables).
const breadcrumb = (batch: string) => [{ href: "/intelligence", label: "Home" }, { href: "/passports", label: "Batch records" }, { label: batch }] as const;

/** The hero's aside: the evidence figure, framed in ink so it reads as a measurement and never as a verdict. */
function EvidenceAside({ confidence }: { confidence: unknown }) {
  return (
    <Frame as="aside" tone="ink" ariaLabel="Evidence strength">
      <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-white/70">How strong is the evidence?</p>
      <p className="mt-2 text-5xl font-extrabold tabular-nums tracking-[-.045em]">{Math.round(Number(confidence) * 100)}%</p>
      <p className="mt-2 text-xs font-medium text-white/70">This is not a safety score</p>
    </Frame>
  );
}

/** A dimension's status glyph, in the same tone as its card. */
function StatusIcon({ status }: { status: string }) {
  if (status === "established") return <CheckCircle2 className="size-4 text-[#0b6b60]" aria-hidden="true" />;
  if (status === "conflicting") return <AlertTriangle className="size-4 text-[#9b6b22]" aria-hidden="true" />;
  return <CircleDashed className="size-4 text-[var(--muted)]" aria-hidden="true" />;
}

/** The closing section every passport ends on: the stored limitation list, then the fixed disclaimer. */
function Limitations({ number, items, children }: { number: number; items: string[]; children: React.ReactNode }) {
  return (
    <NumberedSection id="limits" number={number} eyebrow="Limits" title="Known limitations">
      <Notice tone="warn" icon={Fingerprint}>
        {items.length > 0 && <ul className="list-disc space-y-1 pl-5">{items.map((x) => <li key={x}>{x}</li>)}</ul>}
        <p className={items.length > 0 ? "mt-3" : ""}>{children}</p>
      </Notice>
    </NumberedSection>
  );
}

// Live passport: a real batch backed by external independent certificates (no VialGrade-run custody).
const LIVE_CONTENTS: readonly ContentsItem[] = [
  { id: "basis", label: "The number" }, { id: "checked", label: "What was checked" }, { id: "reports", label: "Lab reports" }, { id: "limits", label: "Limitations" },
];

function LivePassport({ p, basis, evidence }: { p: Record<string, unknown>; basis: LivePassportBasis; evidence: LivePassportEvidence[] }) {
  const agree = basis.purity?.agreement;
  const agreeLabel = agree === "agree" ? "The reports agree" : agree === "conflict" ? "The reports disagree" : agree === "mixed" ? "Results are spread out" : agree === "single" ? "Only one report" : "No purity result";
  const dims: [string, string][] = [["purity", "Purity"], ["content", "Content / dose"], ["sterility", "Sterility"], ["endotoxin", "Endotoxin"], ["heavy-metals", "Heavy metals"]];
  const typeLabel: Record<string, string> = { sterility: "Sterility", endotoxin: "Endotoxin", "heavy-metals": "Heavy metals", dimer: "Dimer", blend: "Blend", screening: "ID screen", identity: "Identity" };
  const batch = String(p.declared_batch_code);
  const compound = String(p.product_name || p.compound_name || "Compound not linked");
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero art={["coa", "magnifier"]} breadcrumb={breadcrumb(batch)}
        eyebrow={<><Fingerprint className="size-4" aria-hidden="true" /> Batch test record · Independent lab reports</>}
        title={batch}
        actions={<>
          {p.vendor_slug ? <Pill href={`/vendors/${String(p.vendor_slug)}`} variant="ghost" size="sm" arrow="right">{String(p.vendor_name)}</Pill> : <Chip plain>{String(p.vendor_name || "Vendor not linked")}</Chip>}
          {p.compound_slug ? <Pill href={`/compounds/${String(p.compound_slug)}`} variant="ghost" size="sm" arrow="right">{compound}</Pill> : <Chip plain>{compound}</Chip>}
        </>}
        aside={<EvidenceAside confidence={p.evidence_confidence} />}
      />

      <Section tight>
        <ContentsLayout contents={LIVE_CONTENTS} label="Batch record sections">
          <NumberedSection id="basis" number={1} eyebrow="Evidence strength" title="Where that number comes from">
            <p className={UI.body + " max-w-3xl"}>It is worked out from the real lab reports for this batch — nothing hidden. It goes up with more reports, more different labs, samples bought blind, and results that agree; it goes down when reports disagree or get old. Reports like these can never be as certain as a regulator&rsquo;s, so the number is capped well below 100%.</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat value={basis.sampleCount} label="Lab reports" note={`${basis.independentLabCount} independent lab${basis.independentLabCount === 1 ? "" : "s"}`} />
              <Stat value={basis.labs?.length ?? 0} label="Labs involved" note={(basis.labs ?? []).join(" · ") || "—"} />
              <Stat value={basis.hasBlind ? "Bought blind" : "The vendor did"} label="Who picked the sample" note={basis.hasBlind ? "Someone bought it like a normal customer" : "The seller chose the vial that got tested"} />
              <Stat value={agreeLabel} label="Do the results agree?" note={basis.purity?.min != null ? `${basis.purity.min}%–${basis.purity.max}%` : "—"} />
            </div>
          </NumberedSection>

          <NumberedSection id="checked" number={2} eyebrow="Dimensions" title="What was actually checked">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {dims.map(([key, label]) => {
                const status = String(basis.dimensions?.[key] || "unknown");
                return (
                  <Frame key={key} thin shadow="none" pad="sm" radius="rounded-[14px]" tone={DIMENSION_STATUS_TONE[status] ?? "white"}>
                    <div className="flex items-center justify-between gap-2"><h3 className={UI.h4}>{label}</h3><StatusIcon status={status} /></div>
                    <p className={UI.eyebrowMuted + " mt-2"}>{DIMENSION_STATUS_WORDS[status] ?? status}</p>
                    {key === "purity" && status === "established" && <p className={UI.bodyInk + " mt-3"}>Typically {basis.purity?.median}% pure across {basis.sampleCount} report{basis.sampleCount === 1 ? "" : "s"}</p>}
                  </Frame>
                );
              })}
            </div>
          </NumberedSection>

          <NumberedSection id="reports" number={3} eyebrow="Original documents" title="The lab reports behind this batch" flush
            intro="Every lab report tied to this batch, the most independent ones first. Open any one to read the original document.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[#fbfbf8] text-[10px] uppercase tracking-[.12em] text-[var(--muted)]"><tr><th className="px-5 py-3 font-bold">Lab</th><th className="px-5 py-3 font-bold">Sample</th><th className="px-5 py-3 font-bold">Purity</th><th className="px-5 py-3 font-bold">Type</th><th className="px-5 py-3 font-bold"></th></tr></thead>
                <tbody className="divide-y divide-[#111214]/10">
                  {evidence.map((e, i) => (
                    <tr key={i}>
                      <td className="px-5 py-3 font-bold text-[#111214]">{e.lab}</td>
                      <td className={"px-5 py-3 " + UI.small}>{e.sampleName}</td>
                      <td className="px-5 py-3">{e.purityPct != null ? <Chip plain tone="mint" className="tabular-nums">{Number(e.purityPct).toFixed(2)}%</Chip> : <span className={UI.small}>See report</span>}</td>
                      <td className="px-5 py-3">
                        <span className="flex flex-wrap gap-1">
                          {e.isBlind && <Chip tone="blue" icon={EyeOff}>Blind</Chip>}
                          {e.testType !== "purity" && typeLabel[e.testType] && <Chip tone="blue" icon={ShieldCheck}>{typeLabel[e.testType]}</Chip>}
                          {(!e.isBlind && e.testType === "purity") && <span className={UI.small}>—</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3"><a href={e.verifyUrl} target="_blank" rel="noopener nofollow" className={UI.linkSmall}>Verify<ArrowUpRight className="size-3.5" aria-hidden="true" /></a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </NumberedSection>

          <Limitations number={4} items={basis.limitations ?? []}>
            This page gathers the independent lab reports for one batch. It is not medical advice, it is not a ruling that the product is safe, and it is not proof that the vial you receive matches the ones that were tested.
          </Limitations>
        </ContentsLayout>
      </Section>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadPassport(slug);
  if (!data) notFound();
  const p = data.passport as Record<string, unknown>;
  if (p.origin === "live") return <LivePassport p={p} basis={obj(p.confidence_basis) as unknown as LivePassportBasis} evidence={(data.labTests ?? []) as LivePassportEvidence[]} />;
  const dimensions = obj(p.dimensions);
  const sampleIds = [...new Set(data.custody.map((e: Record<string, unknown>) => String(e.sample_id)))];
  const chainChecks = await Promise.all(sampleIds.map(async id => [id, await verifyCustodyChain(id)] as const));
  const checks = new Map(chainChecks);
  const basis = obj(p.confidence_basis);
  const hasBasis = Object.keys(basis).length > 0;
  const batch = String(p.declared_batch_code);
  // The sections in their fixed order; two only exist when the record has something to say, so the
  // numbering and the contents list are taken from what actually renders.
  const contents: ContentsItem[] = [
    hasBasis ? { id: "basis", label: "The number" } : null,
    { id: "checked", label: "What was checked" },
    data.conflicts.length > 0 ? { id: "conflicts", label: "Disagreements" } : null,
    { id: "reports", label: "Lab reports" },
    { id: "custody", label: "Sample handling" },
    { id: "limits", label: "Limitations" },
  ].filter((item): item is ContentsItem => item !== null);
  const num = (id: string) => contents.findIndex((item) => item.id === id) + 1;
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero art={["coa", "magnifier"]} breadcrumb={breadcrumb(batch)}
        eyebrow={<><Fingerprint className="size-4" aria-hidden="true" /> Batch test record · {SAMPLING_WORDS[String(p.sampling_level ?? "")] ?? "Tested batch"}</>}
        title={batch}
        actions={<>
          <Chip plain>{String(p.vendor_name || "Vendor not linked")}</Chip>
          <Chip plain>{String(p.product_name || "Product not linked")}</Chip>
        </>}
        aside={<EvidenceAside confidence={p.evidence_confidence} />}
      />

      <Section tight>
        <ContentsLayout contents={contents} label="Batch record sections">
          {hasBasis && (() => {
            const independence = obj(basis.independence);
            const dim = obj(basis.dimensionSummary);
            return (
              <NumberedSection id="basis" number={num("basis")} eyebrow="Evidence strength" title="Where that number comes from">
                <p className={UI.body + " max-w-3xl"}>We never show a number you can&rsquo;t take apart. This figure is sampling level <span className="font-bold text-[#111214]">{String(basis.samplingLevel)}</span> ({Math.round(Number(basis.samplingBaseConfidence) * 100)}% base){basis.conflictPenaltyApplied ? <> reduced by an open-conflict penalty (×{String(basis.conflictPenaltyFactor)})</> : null}, computed over {String(independence.totalObservations)} approved observations.</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Stat value={`${String(independence.independentSampleCount)} blind`} label="Sampling independence" note={arr(independence.samplingModels).map((m: unknown) => String(m).replaceAll("_", " ")).join(" · ") || "—"} />
                  <Stat value={arr(basis.laboratories).length} label="Contributing labs" note={arr(basis.laboratories).join(" · ") || "—"} />
                  <Stat value={arr(basis.methods).length} label="Methods applied" note={`${String(independence.totalObservations)} approved results`} />
                  <Stat value={`${arr(dim.established).length} · ${arr(dim.conflicting).length} · ${arr(dim.unknown).length}`} label="Dimensions" note="established · conflicting · unknown" />
                </div>
              </NumberedSection>
            );
          })()}

          <NumberedSection id="checked" number={num("checked")} eyebrow="Dimensions" title="What was actually checked">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {["identity", "purity", "quantity", "sterility", "endotoxin", "particulates"].map(key => {
                const d = obj(dimensions[key]);
                const observations = arr(d.observations);
                const status = String(d.status || "unknown");
                return (
                  <Frame key={key} thin shadow="none" pad="sm" radius="rounded-[14px]" tone={DIMENSION_STATUS_TONE[status] ?? "white"}>
                    <div className="flex items-center justify-between gap-2"><h3 className={UI.h4 + " capitalize"}>{key}</h3><StatusIcon status={status} /></div>
                    <p className={UI.eyebrowMuted + " mt-2"}>{DIMENSION_STATUS_WORDS[status] ?? status}</p>
                    {observations.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {observations.map((o: unknown, i: number) => {
                          const x = obj(o);
                          return (
                            <div key={i} className="rounded-[12px] border border-[#111214]/15 bg-white p-3 text-xs">
                              <p className="font-bold text-[#111214]">{String(x.value)} {String(x.unit || "")}</p>
                              <p className={UI.small + " mt-1"}>{String(x.samplingModel).replaceAll("_", " ")} · {String(x.reportNumber)}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Frame>
                );
              })}
            </div>
          </NumberedSection>

          {data.conflicts.length > 0 && (
            <NumberedSection id="conflicts" number={num("conflicts")} eyebrow="Open conflicts" title="Where the results disagree">
              {data.conflicts.map((c: Record<string, unknown>) => (
                <Notice key={String(c.id)} tone="warn" icon={AlertTriangle} title={<span className="capitalize">{String(c.dimension)}</span>}>
                  <p>{String(c.explanation)}</p>
                </Notice>
              ))}
            </NumberedSection>
          )}

          <NumberedSection id="reports" number={num("reports")} eyebrow="Original documents" title="The lab reports">
            <div className="grid gap-3 lg:grid-cols-2">
              {data.reports.map((r: Record<string, unknown>) => (
                <Quiet key={String(r.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-[#2b31d8]">{String(r.report_number)} · v{String(r.version)}</p>
                      <h3 className={UI.h4 + " mt-2"}>Sample {String(r.sample_code)}</h3>
                      <p className={UI.body + " mt-1 capitalize"}>{String(r.sampling_model).replaceAll("_", " ")}</p>
                    </div>
                    <Chip plain tone="mint">{String(r.status)}</Chip>
                  </div>
                  <p className={UI.body + " mt-3"}>{String(r.public_summary)}</p>
                  <Link href={`/labs/${String(r.laboratory_slug)}`} className={UI.link + " mt-4"}>{String(r.laboratory_name)}<ArrowRight className="size-4" aria-hidden="true" /></Link>
                </Quiet>
              ))}
            </div>
          </NumberedSection>

          <NumberedSection id="custody" number={num("custody")} eyebrow="Chain of custody" title="Who handled the sample">
            {sampleIds.map(sampleId => {
              const events = data.custody.filter((e: Record<string, unknown>) => String(e.sample_id) === sampleId);
              const check = checks.get(sampleId);
              return (
                <Quiet key={sampleId}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className={UI.h4}>Sample {String(events[0]?.sample_code || sampleId)}</h3>
                      <p className={UI.small + " mt-1"}>{events.length} recorded handoffs</p>
                    </div>
                    <Chip tone={check?.valid ? "mint" : "danger"} icon={check?.valid ? CheckCircle2 : AlertTriangle}>{check?.valid ? "Trail is intact" : "Trail is broken"}</Chip>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {events.map((e: Record<string, unknown>) => (
                      <div key={String(e.id)} className="rounded-[12px] border border-[#111214]/15 bg-white p-3">
                        <p className="text-xs font-bold capitalize text-[#111214]">#{String(e.sequence_number)} {String(e.event_type).replaceAll("_", " ")}</p>
                        <p className={UI.small + " mt-1"}>{String(e.location || "No location")} · {new Date(String(e.occurred_at)).toLocaleString()}</p>
                        <p className="mt-2 font-mono text-[9px] text-[var(--muted)]">{String(e.event_hash).slice(0, 18)}…</p>
                      </div>
                    ))}
                  </div>
                </Quiet>
              );
            })}
          </NumberedSection>

          <Limitations number={num("limits")} items={arr(p.limitations).map((x: unknown) => String(x))}>
            This page describes what was found in specific samples. It is not medical advice, it is not a ruling that the product is safe, and it is not proof that every unit is the same.
          </Limitations>
        </ContentsLayout>
      </Section>
    </div>
  );
}
