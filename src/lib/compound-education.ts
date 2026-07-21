// Plain-English education so a first-time buyer understands what a compound actually IS
// and what it's researched for — the "I just want to know what this is for" need.
//
// STRICT framing: research-context only. Goals are neutral category tags (what communities
// research it toward), summaries describe class/context, never efficacy, dosing, or human-use
// advice. "Stacks" = compounds commonly discussed together in research, not a protocol.
// This is a pure data module (no server deps) so both server pages and client cards can read it.

export interface CompoundEducation {
  goals: string[];            // neutral research-goal tags
  summary?: string;           // one plain sentence: what it is / what it's researched toward
  stackedWith?: string[];     // compound slugs commonly discussed together
}

// Canonical goal tags, with the color the UI tints them.
export const GOAL_TAGS: Record<string, { label: string; tone: string }> = {
  recovery: { label: "Recovery & healing", tone: "emerald" },
  gut: { label: "Gut health", tone: "emerald" },
  gh: { label: "Growth hormone support", tone: "blue" },
  metabolic: { label: "Weight & metabolic", tone: "violet" },
  longevity: { label: "Longevity & anti-aging", tone: "violet" },
  cognitive: { label: "Cognitive & mood", tone: "blue" },
  skin: { label: "Skin & cosmetic", tone: "amber" },
  tanning: { label: "Tanning & libido", tone: "amber" },
  immune: { label: "Immune & thymic", tone: "emerald" },
  muscle: { label: "Muscle & performance", tone: "blue" },
  sleep: { label: "Sleep", tone: "violet" },
  hormonal: { label: "Reproductive & hormonal", tone: "violet" },
};

export const COMPOUND_EDUCATION: Record<string, CompoundEducation> = {
  "bpc-157": { goals: ["recovery", "gut"], summary: "One of the most-discussed peptides in tissue-recovery and gut-health research. Preclinical studies have looked at connective-tissue and gastrointestinal models. The classic partner to TB-500.", stackedWith: ["tb-500", "ghk-cu", "kpv"] },
  "pentadeca-arginate": { goals: ["recovery", "gut"], summary: "A newer arginate-salt relative of BPC-157, marketed for similar tissue-recovery research contexts with claimed improved stability.", stackedWith: ["tb-500"] },
  "tb-500": { goals: ["recovery", "muscle"], summary: "A fragment of thymosin beta-4 studied in recovery, flexibility, and tissue-repair research. Almost always discussed alongside BPC-157.", stackedWith: ["bpc-157", "ghk-cu"] },
  "thymosin-beta-4": { goals: ["recovery", "immune"], summary: "The full parent protein of TB-500, studied in tissue-repair and regenerative research.", stackedWith: ["bpc-157"] },
  "ghk-cu": { goals: ["skin", "recovery", "longevity"], summary: "A copper peptide famous in skincare and hair research for collagen and cosmetic contexts, also discussed for tissue recovery. The 'GLOW' in the popular recovery blend.", stackedWith: ["bpc-157", "tb-500"] },
  "kpv": { goals: ["gut", "recovery", "immune"], summary: "A short anti-inflammatory tripeptide studied in gut and inflammatory-condition research, often paired with BPC-157 for gut-focused stacks.", stackedWith: ["bpc-157"] },
  "ara-290": { goals: ["recovery", "immune"], summary: "An EPO-derived peptide studied in nerve and inflammatory-pain research contexts." },
  "larazotide": { goals: ["gut"], summary: "A gut tight-junction peptide studied in intestinal-permeability ('leaky gut') and celiac research." },
  "ll-37": { goals: ["immune", "recovery"], summary: "A human antimicrobial peptide studied in immune-defense and wound research." },
  "ipamorelin": { goals: ["gh", "recovery"], summary: "A gentle, selective growth-hormone secretagogue popular in GH research — the usual partner to CJC-1295.", stackedWith: ["cjc-1295", "tesamorelin"] },
  "cjc-1295": { goals: ["gh", "muscle"], summary: "A GHRH analog studied for sustained growth-hormone research. The canonical CJC-1295 + Ipamorelin stack is the most-discussed GH combo.", stackedWith: ["ipamorelin"] },
  "sermorelin": { goals: ["gh"], summary: "A GHRH-fragment peptide studied in growth-hormone and age-related research.", stackedWith: ["ipamorelin"] },
  "tesamorelin": { goals: ["gh", "metabolic"], summary: "A GHRH analog known from prescription use for visceral-fat research contexts.", stackedWith: ["ipamorelin"] },
  "hexarelin": { goals: ["gh"], summary: "A potent ghrelin-mimetic growth-hormone secretagogue studied in GH research." },
  "ghrp-2": { goals: ["gh"], summary: "A growth-hormone-releasing peptide studied in GH and appetite research.", stackedWith: ["cjc-1295"] },
  "ghrp-6": { goals: ["gh"], summary: "A growth-hormone-releasing peptide known for strong appetite effects in research.", stackedWith: ["cjc-1295"] },
  "mk-677": { goals: ["gh", "muscle"], summary: "An orally-active ghrelin mimetic (Ibutamoren) widely discussed in growth-hormone and body-composition research — a non-injectable favorite." },
  "mgf": { goals: ["muscle", "recovery"], summary: "A mechano growth factor peptide studied in muscle-repair research." },
  "peg-mgf": { goals: ["muscle", "recovery"], summary: "A longer-acting pegylated MGF studied in muscle-recovery research." },
  "igf-1-lr3": { goals: ["muscle"], summary: "A long-acting IGF-1 analog studied in muscle-growth research." },
  "semaglutide": { goals: ["metabolic"], summary: "The GLP-1 analog behind Ozempic and Wegovy — the most-searched compound in weight and metabolic research.", stackedWith: ["cagrilintide"] },
  "tirzepatide": { goals: ["metabolic"], summary: "The dual GIP/GLP-1 agonist behind Mounjaro and Zepbound, studied heavily in weight and metabolic research." },
  "retatrutide": { goals: ["metabolic"], summary: "A triple-agonist (GIP/GLP-1/glucagon) — the newest and most-discussed weight-research compound." },
  "cagrilintide": { goals: ["metabolic"], summary: "An amylin analog studied in weight research, often discussed alongside semaglutide ('CagriSema').", stackedWith: ["semaglutide"] },
  "survodutide": { goals: ["metabolic"], summary: "A glucagon/GLP-1 dual agonist studied in weight and liver research." },
  "mazdutide": { goals: ["metabolic"], summary: "A GLP-1/glucagon dual agonist studied in weight and metabolic research." },
  "liraglutide": { goals: ["metabolic"], summary: "An earlier daily GLP-1 analog (Victoza/Saxenda) studied in metabolic and weight research." },
  "aod-9604": { goals: ["metabolic", "recovery"], summary: "A modified HGH fragment studied in fat-metabolism and, more recently, cartilage/recovery research." },
  "hgh-fragment-176-191": { goals: ["metabolic"], summary: "The HGH C-terminal fragment studied in fat-loss research." },
  "tesofensine": { goals: ["metabolic", "cognitive"], summary: "A triple monoamine reuptake inhibitor studied in appetite and weight research." },
  "5-amino-1mq": { goals: ["metabolic"], summary: "A small-molecule NNMT inhibitor studied in metabolism and fat-cell research." },
  "slu-pp-332": { goals: ["metabolic", "muscle"], summary: "An 'exercise-mimetic' ERR agonist studied in endurance and metabolic research." },
  "epitalon": { goals: ["longevity"], summary: "A pineal tetrapeptide famous in longevity and telomere research — the flagship 'anti-aging' peptide.", stackedWith: ["nad-plus"] },
  "mots-c": { goals: ["longevity", "metabolic"], summary: "A mitochondrial peptide studied in metabolism, exercise-capacity, and longevity research.", stackedWith: ["nad-plus"] },
  "ss-31": { goals: ["longevity"], summary: "A mitochondria-targeting peptide (Elamipretide) studied in mitochondrial-function and aging research." },
  "humanin": { goals: ["longevity"], summary: "A mitochondrial-derived peptide studied in cytoprotection and aging research." },
  "nad-plus": { goals: ["longevity"], summary: "The NAD+ coenzyme central to cellular energy and a cornerstone of longevity research.", stackedWith: ["epitalon", "mots-c"] },
  "thymalin": { goals: ["immune", "longevity"], summary: "A thymic bioregulator peptide studied in immune-aging research." },
  "pinealon": { goals: ["cognitive", "longevity"], summary: "A short bioregulator peptide studied in brain and aging research." },
  "semax": { goals: ["cognitive"], summary: "A Russian nootropic peptide studied in focus, memory, and neuroprotection research. Often paired with Selank.", stackedWith: ["selank"] },
  "selank": { goals: ["cognitive"], summary: "A nootropic peptide studied in anxiety and cognition research — the calm counterpart to Semax.", stackedWith: ["semax"] },
  "dihexa": { goals: ["cognitive"], summary: "An angiotensin-derived peptide studied in synapse-formation and cognition research." },
  "cerebrolysin": { goals: ["cognitive"], summary: "A brain-derived peptide mixture studied in neuroprotection and recovery research." },
  "p21": { goals: ["cognitive"], summary: "A CNTF-derived peptidomimetic studied in neurogenesis research." },
  "argireline": { goals: ["skin"], summary: "A topical 'Botox-in-a-bottle' peptide studied in expression-line cosmetic research." },
  "snap-8": { goals: ["skin"], summary: "A topical cosmetic peptide, an extended relative of Argireline." },
  "matrixyl": { goals: ["skin"], summary: "A collagen-fragment cosmetic peptide widely used in anti-wrinkle skincare research." },
  "melanotan-1": { goals: ["tanning"], summary: "A melanocortin peptide studied in skin-pigmentation and photoprotection research." },
  "melanotan-2": { goals: ["tanning"], summary: "A melanocortin peptide studied in tanning and libido research — the most-discussed 'tanning peptide'.", stackedWith: ["pt-141"] },
  "pt-141": { goals: ["tanning", "hormonal"], summary: "Bremelanotide, a melanocortin peptide studied in libido and sexual-function research.", stackedWith: ["melanotan-2"] },
  "kisspeptin-10": { goals: ["hormonal"], summary: "A reproductive-hormone peptide studied in fertility and hormonal-axis research." },
  "gonadorelin": { goals: ["hormonal"], summary: "A GnRH peptide studied in reproductive-hormone and post-cycle research." },
  "thymosin-alpha-1": { goals: ["immune"], summary: "A thymic peptide (Zadaxin) studied in immune-modulation and antiviral research." },
  "thymulin": { goals: ["immune"], summary: "A zinc-dependent thymic hormone studied in immune research." },
  "dsip": { goals: ["sleep", "cognitive"], summary: "The 'delta sleep-inducing peptide', studied in sleep and stress research." },
  "adipotide": { goals: ["metabolic"], summary: "A vasculature-targeting peptide studied in fat-loss research." },
  "follistatin-344": { goals: ["muscle"], summary: "A myostatin-inhibiting protein studied in muscle-growth research." },
  "vip": { goals: ["immune", "recovery"], summary: "Vasoactive intestinal peptide, studied in immune and inflammatory research." },
  "oxytocin": { goals: ["hormonal", "cognitive"], summary: "The 'bonding hormone' peptide, studied in social, mood, and hormonal research." },
  "glutathione": { goals: ["longevity", "skin"], summary: "The master antioxidant tripeptide, discussed in detox, skin-brightening, and longevity research." },
};

export function educationFor(slug: string): CompoundEducation | undefined {
  return COMPOUND_EDUCATION[slug];
}

export function goalLabel(key: string): string {
  return GOAL_TAGS[key]?.label ?? key;
}
