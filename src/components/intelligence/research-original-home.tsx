import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Layers3, SearchCheck, ShieldCheck, X } from "lucide-react";
import { ArtCoa, ArtFlask, ArtMagnifierVial, ArtMolecule, ArtShieldCheck, VialBuddy, VialPlain } from "@/components/vial-art";
import { RESEARCH_SUBJECTS, RESEARCH_THEMES } from "@/lib/research-explorer";

const CATALOG = "/intelligence/market";

export function OriginalResearchHero() {
  return (
    <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-[var(--background)]">
      <div aria-hidden="true" className="hero-grid pointer-events-none absolute inset-0 -z-10 opacity-40" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <VialBuddy className="gum-float absolute left-[4%] top-[24%] hidden w-[86px] drop-shadow-[5px_5px_0_#111214] md:block lg:w-28" liquid="#2b31d8" />
        <ArtMolecule className="gum-float-slow absolute right-[5%] top-[15%] hidden w-24 drop-shadow-[5px_5px_0_#111214] sm:block lg:w-28" />
        <ArtFlask className="gum-float-rev absolute right-[9%] bottom-[10%] hidden w-16 drop-shadow-[4px_4px_0_#111214] md:block lg:w-20" fill="#12b3a6" />
        <ArtShieldCheck className="gum-float absolute left-[10%] bottom-[9%] hidden w-16 drop-shadow-[4px_4px_0_#111214] sm:block lg:w-[76px]" />
      </div>
      <div className="mx-auto max-w-[1080px] px-5 pb-20 pt-16 text-center sm:px-8 sm:pb-28 sm:pt-24">
        <div className="ink hard-sm mx-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-[#111214]">
          <ShieldCheck className="size-3.5 text-[#2b31d8]" /> The research verification layer
        </div>
        <h1 className="mx-auto mt-8 max-w-[16ch] text-balance text-[clamp(3.3rem,9.2vw,8rem)] font-extrabold leading-[.84] tracking-[-.055em]">
          Know what&apos;s <span className="text-[#2b31d8]">behind the claim.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-[53ch] text-balance text-lg font-medium leading-8 text-[var(--muted)] sm:text-xl">
          Compounds, original studies, and source records in one place. See what the research actually documents, and what it doesn&apos;t.
        </p>
        <div className="mx-auto mt-10 max-w-2xl">
          <Link href="/intelligence/verify"
            className="ink hard press group flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-4 text-left sm:px-5"
            aria-label="Check a study, claim or compound source">
            <SearchCheck className="size-5 shrink-0 text-[#2b31d8]" />
            <span className="flex-1 text-sm font-medium text-[#111214]/70 sm:text-base">Check a study, claim, or compound source</span>
            <span className="shrink-0 rounded-xl bg-[#2b31d8] px-4 py-2 text-xs font-bold text-white group-hover:bg-[#201bb5]">Check it</span>
          </Link>
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-[#111214]/70">
          {["16 curated compound records", "Original records linked", "Uncertainties kept visible"].map(label => (
            <span key={label} className="inline-flex items-center gap-1.5"><Check className="size-4 text-[#0e8f80]" />{label}</span>
          ))}
        </div>
        <Link href={CATALOG} className="mt-5 inline-flex items-center gap-1 text-sm font-extrabold text-[#2b31d8] underline underline-offset-4">
          Explore the research market <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

const BEFORE = [
  "A molecule name without its exact identity",
  "A paper quoted without its original link",
  "Different studies treated as one result",
  "A certificate claim with no lot relationship",
];
const AFTER = [
  "A compound reference you can open",
  "The original study and registered intervention",
  "Missing results or unresolved matches identified",
  "Issuer statements separated from independent checks",
];
export function OriginalResearchManifesto() {
  return (
    <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <ArtFlask className="gum-float-slow absolute left-[4%] bottom-8 hidden w-16 drop-shadow-[4px_4px_0_#111214] lg:block" />
      </div>
      <div className="mx-auto max-w-[1080px] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Why VialGrade exists</p>
          <h2 className="mt-4 text-balance text-[clamp(2.6rem,6vw,4.4rem)] font-extrabold leading-[.92] tracking-[-.045em]">
            A claim isn&apos;t <span className="text-[#2b31d8]">the evidence.</span>
          </h2>
          <p className="mt-5 text-lg font-medium leading-8 text-[var(--muted)]">
            Finding a paper is the beginning. The harder part is checking the exact compound, the experiment, and what the source can really support.
          </p>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <div className="ink hard rounded-[22px] bg-white p-7 sm:p-9">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#ce403b]">What a search result leaves out</p>
            <p className="mt-3 text-2xl font-extrabold tracking-[-.03em] text-[#111214]/65">Here&apos;s the finding. Trust the summary.</p>
            <ul className="mt-6 space-y-3.5">{BEFORE.map(item => (
              <li key={item} className="flex items-start gap-3 text-[15px] font-medium leading-6 text-[#111214]/70">
                <span className="ink-1 mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-[#ffecea]"><X className="size-3.5 text-[#ce403b]" /></span>{item}
              </li>
            ))}</ul>
          </div>
          <div className="ink hard-blue relative rounded-[22px] bg-white p-7 sm:p-9">
            <span className="ink absolute right-6 top-6 rounded-full bg-[#2b31d8] px-3 py-1 text-[11px] font-bold uppercase tracking-[.1em] text-white">The VialGrade way</span>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#2b31d8]">What you can inspect</p>
            <p className="mt-3 max-w-[16ch] text-2xl font-extrabold tracking-[-.03em]">Here&apos;s the source. Check it yourself.</p>
            <ul className="mt-6 space-y-3.5">{AFTER.map(item => (
              <li key={item} className="flex items-start gap-3 text-[15px] font-semibold leading-6">
                <span className="ink-1 mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-[#2b31d8]"><Check className="size-3.5 text-white" /></span>{item}
              </li>
            ))}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: ArtMolecule, name: "Exact compound identities", body: "Trace the name to a named reference. Analogues and closely related peptides stay separate.", href: "/intelligence/market" , tint: "bg-[#eef0ff]" },
  { icon: ArtMagnifierVial, name: "Studies, with the context", body: "Follow the registered intervention and original record without assuming the study proved an outcome.", href: "/intelligence/studies/NCT01594762", tint: "bg-[#e6fbf6]" },
  { icon: ArtCoa, name: "The receipts, kept", body: "See where a research claim came from and which source relationships still need review.", href: "/intelligence/passports/pexiganan", tint: "bg-[#eef0ff]" },
  { icon: ArtShieldCheck, name: "A clear verification boundary", body: "A linked file isn't a tested vial. VialGrade keeps source coverage separate from efficacy or lab quality.", href: "/intelligence/grading", tint: "bg-[#e6fbf6]" },
] as const;

export function OriginalResearchFeatures() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-28">
      <div className="max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">What VialGrade does</p>
        <h2 className="mt-4 text-balance text-[clamp(2.6rem,6vw,4.4rem)] font-extrabold leading-[.92] tracking-[-.045em]">
          Everything you&apos;d check, <span className="text-[#2b31d8]">in one place.</span>
        </h2>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {FEATURES.map(({ name, body, icon: Icon, tint, href }) => (
          <Link key={name} href={href} className="ink hard press flex flex-col rounded-[22px] bg-white p-8 sm:p-9">
            <div className={"ink-1 mb-7 grid size-24 place-items-center rounded-2xl " + tint}><Icon className="w-16" /></div>
            <h3 className="text-2xl font-extrabold tracking-[-.03em]">{name}</h3>
            <p className="mt-3 max-w-md text-[15px] font-medium leading-7 text-[var(--muted)]">{body}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#2b31d8]">See the record <ArrowUpRight className="size-4" /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ResearchThemeRail() {
  return (
    <nav aria-label="Research category shortcuts" className="scroll-fade-x -mx-5 overflow-x-auto px-5 pb-3 no-scrollbar sm:-mx-8 sm:px-8">
      <div className="flex w-max gap-3">
        {[{ id: "all", short: "All research", count: RESEARCH_SUBJECTS.length }, ...RESEARCH_THEMES.map(item => ({
          id: item.id, short: item.name, count: RESEARCH_SUBJECTS.filter(s => s.theme === item.id).length,
        }))].map(item => (
          <Link key={item.id} href={CATALOG + (item.id === "all" ? "" : "?theme=" + item.id) + "#browse"}
            className="ink-1 hard-sm press inline-flex shrink-0 items-center gap-2.5 rounded-full bg-white py-2 pl-2 pr-5 text-[15px] font-bold text-[#111214]">
            <span className="grid size-8 place-items-center rounded-full bg-[#12b3a6] text-white"><Layers3 className="size-4" /></span>
            {item.short} <span className="tabular-nums opacity-50">{item.count}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function OriginalResearchCategorySection() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
      <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Explore by biology</p>
      <h2 className="mt-3 max-w-lg text-balance text-[clamp(2.4rem,6vw,4rem)] font-extrabold leading-[.92] tracking-[-.045em]">What are you <span className="text-[#2b31d8]">researching?</span></h2>
      <p className="mt-3 mb-6 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">Choose a research area, then inspect each compound&apos;s identity and linked original records.</p>
      <ResearchThemeRail />
    </section>
  );
}

export function OriginalResearchBigNumber() {
  return (
    <section className="border-y-2 border-[#111214] bg-[#2b31d8] text-white">
      <div className="mx-auto max-w-[1080px] px-5 py-20 text-center sm:px-8 sm:py-24">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-white/70">Curated research starter library</p>
        <p className="mt-4 text-[clamp(5.5rem,20vw,15rem)] font-extrabold leading-[.78] tracking-[-.055em]">16</p>
        <p className="mx-auto mt-6 max-w-xl text-xl font-medium leading-8 text-white/90">
          peptide and compound identity files linked to original references. A starting point for research, not sixteen independently validated scientific verdicts.
        </p>
        <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-4 border-t border-white/25 pt-8">
          {[[4, "research areas"], [5, "selected trial examples"], [0, "physical lots authenticated"]].map(([value,label]) => (
            <div key={label}>
              <p className="text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">{value}</p>
              <p className="mt-1 text-xs font-semibold text-white/75">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const LIQUIDS = ["#2b31d8", "#12b3a6", "#6d5dfc", "#e0872b", "#d8467f", "#2b8fe0"];
const FEATURED = ["pexiganan", "magainin-2", "semaglutide", "tirzepatide", "somatostatin-14", "octreotide"];
export function OriginalResearchCompoundsShowcase() {
  const subjects = FEATURED.map(slug => RESEARCH_SUBJECTS.find(s => s.slug === slug)!).filter(Boolean);
  return (
    <section id="explore" className="scroll-mt-36 border-y-2 border-[#111214] bg-[var(--background)]">
      <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Start with a source</p>
            <h2 className="mt-4 text-balance text-[clamp(2.4rem,5.5vw,4rem)] font-extrabold leading-[.92] tracking-[-.045em]">
              The compounds <span className="text-[#2b31d8]">in the research library.</span>
            </h2>
          </div>
          <Link href={CATALOG} className="ink hard-sm press inline-flex items-center gap-1.5 rounded-full bg-[#2b31d8] px-5 py-3 text-sm font-bold text-white">View full catalog <ArrowRight className="size-4" /></Link>
        </div>
        <div className="mt-12 grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject,index) => (
            <Link key={subject.slug} href={"/intelligence/explore/" + subject.slug} className="ink-1 hard press group flex min-w-0 items-center gap-5 rounded-[20px] bg-white p-5">
              <div className="ink-1 grid size-[88px] shrink-0 place-items-center rounded-2xl bg-[var(--background)]">
                <VialPlain className="h-[62px]" liquid={LIQUIDS[index % LIQUIDS.length]} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">{subject.family}</p>
                <h3 className="mt-1 truncate text-xl font-extrabold tracking-[-.03em]">{subject.name}</h3>
                <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-semibold text-[#111214]/70">
                  <span>{subject.referenceLabel.match(/CID \d+/)?.[0] || subject.referenceLabel.match(/SID \d+/)?.[0] || "Identity source"}</span>
                  <span className="text-[#2b31d8]">{subject.sampleTrial ? "Selected study on file" : "Identity reference"}</span>
                </div>
              </div>
              <ArrowUpRight className="size-5 shrink-0 transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function OriginalResearchFinalCta() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-24">
      <div className="ink hard relative overflow-hidden rounded-[22px] bg-white px-6 py-14 text-center sm:px-16">
        <VialBuddy liquid="#2b31d8" className="absolute bottom-4 left-4 hidden w-20 sm:block" />
        <ArtMolecule className="absolute right-6 top-6 hidden w-20 sm:block" />
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#2b31d8]">Stay with the source</p>
        <h2 className="mx-auto mt-3 max-w-[18ch] text-balance text-[clamp(2.4rem,5vw,4.5rem)] font-extrabold leading-[.95] tracking-[-.045em]">Run it through VialGrade <span className="text-[#2b31d8]">before you cite it.</span></h2>
        <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-7 text-[var(--muted)]">Start with the compound identity, trace original studies, then inspect the missing information. All physical materials remain unverified.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/intelligence/verify" className="ink hard-sm press rounded-full bg-[#2b31d8] px-6 py-3 text-sm font-bold text-white">Verify a source</Link>
          <Link href={CATALOG} className="ink hard-sm press rounded-full bg-white px-6 py-3 text-sm font-bold">Explore the market <ArrowRight className="inline size-4" /></Link>
        </div>
      </div>
    </section>
  );
}
