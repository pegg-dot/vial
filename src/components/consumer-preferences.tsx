"use client";
import { Check, EyeOff, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { EvidenceLevel } from "@/lib/types";
import type { ConsumerPreferences, EvidencePriority, HomeView } from "@/server/consumer-intelligence/types";

type Option={slug:string;name:string};
const evidenceOptions:Array<{key:EvidencePriority;label:string}>=[{key:"batch_linkage",label:"Does it match this batch"},{key:"report_confirmation",label:"Lab confirmed it’s theirs"},{key:"freshness",label:"How recent the test is"},{key:"sampling",label:"Who picked the sample"},{key:"quantity",label:"Is the dose really there"},{key:"issuer",label:"Which lab did it"}];
// Strongest first, because the bar this control sets is a FLOOR: a record is kept when it meets at
// least one level you pick, so the weakest one you pick is the bar. Ordering the chips by strength
// is what makes that legible.
const evidenceLevelOptions:Array<{key:EvidenceLevel;label:string;hint:string}>=[
  {key:"independent",label:"Independent lab",hint:"Someone other than the vendor bought and tested it"},
  {key:"issuer-confirmed",label:"Issuer confirmed",hint:"The lab confirmed the report is theirs"},
  {key:"vendor-published",label:"Vendor published",hint:"The vendor published a report; nobody confirmed it"},
  {key:"public-only",label:"Public record only",hint:"Nothing beyond what the listing itself says"},
  {key:"stale",label:"Stale",hint:"The last test on record is out of date"},
];
const homeViewLabels:Record<HomeView,string>={"balanced":"balanced","evidence-first":"evidence first","price-first":"price first","changes-first":"changes first"};
const homeViewHints:Record<HomeView,string>={"balanced":"Evidence, price and your follows weighed together.","evidence-first":"Records with the strongest evidence rank first.","price-first":"Cheaper records rank first.","changes-first":"Records with recent reviewed changes rank first."};

export function ConsumerPreferencesForm({initial,compounds,vendors}:{initial:ConsumerPreferences;compounds:Option[];vendors:Option[]}){
  const[value,setValue]=useState(initial);
  const[saved,setSaved]=useState(false);
  const[error,setError]=useState("");
  function toggleArray(key:"evidencePriorities"|"preferredCompoundSlugs",item:string){
    setValue(current=>{const values=current[key] as string[];return {...current,[key]:values.includes(item)?values.filter(value=>value!==item):[...values,item]}});
    setSaved(false);
  }
  // Preferring a vendor and hiding it are contradictory instructions, so picking one clears the
  // other rather than storing a pair the ranker has to arbitrate.
  function toggleVendor(kind:"preferredVendorSlugs"|"hiddenVendorSlugs",slug:string){
    const other=kind==="preferredVendorSlugs"?"hiddenVendorSlugs":"preferredVendorSlugs";
    setValue(current=>{
      const selected=current[kind].includes(slug);
      return {
        ...current,
        [kind]:selected?current[kind].filter(item=>item!==slug):[...current[kind],slug],
        [other]:selected?current[other]:current[other].filter(item=>item!==slug),
      };
    });
    setSaved(false);
  }
  function toggleRequiredLevel(level:EvidenceLevel){
    setValue(current=>({...current,requiredEvidenceLevels:current.requiredEvidenceLevels.includes(level)?current.requiredEvidenceLevels.filter(item=>item!==level):[...current.requiredEvidenceLevels,level]}));
    setSaved(false);
  }
  async function save(){
    setError("");
    const response=await fetch("/api/v1/consumer/preferences",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(value)});
    if(!response.ok){setError("Preferences could not be saved.");return}
    setSaved(true);setTimeout(()=>setSaved(false),1600);
  }
  const weakestRequired=evidenceLevelOptions.filter(option=>value.requiredEvidenceLevels.includes(option.key)).at(-1);
  return <div className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
    <aside className="ink rounded-[20px] bg-[#111214] p-6 text-white">
      <SlidersHorizontal className="size-5 text-white/45"/>
      <h2 className="mt-7 text-3xl font-extrabold tracking-[-.04em]">Your priorities</h2>
      <p className="mt-3 text-sm leading-6 text-white/50">These settings decide what ranks first and which changes alert you. They never recommend using anything, and they can&rsquo;t hide missing evidence.</p>
      <label className="mt-8 flex items-center justify-between gap-4 rounded-[12px] bg-white/[.07] p-4 text-sm font-bold">
        <span>Personalization</span>
        <input type="checkbox" checked={value.personalizationEnabled} onChange={event=>{const personalizationEnabled=event.target.checked;setValue(current=>({...current,personalizationEnabled}));setSaved(false)}} className="size-5 accent-white"/>
      </label>
      <p className="mt-3 text-xs leading-5 text-white/45">{value.personalizationEnabled
        ?"Your follows, watchlist, price range, shipping limit and home priority all shape the ranking."
        :"Off: your follows, watchlist, price range, shipping limit, home priority and evidence weighting are ignored, and records are ranked on evidence quality and availability alone. Hidden vendors and required evidence levels still apply."}</p>
    </aside>
    <section className="space-y-5">
      <div className="ink hard rounded-[20px] bg-white p-6">
        <h3 className="text-2xl font-extrabold">Home priority</h3>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">{(["balanced","evidence-first","price-first","changes-first"] as HomeView[]).map(view=>
          <button type="button" key={view} onClick={()=>{setValue(current=>({...current,homeView:view}));setSaved(false)}} className={`press rounded-[12px] p-4 text-left text-sm font-bold ${value.homeView===view?"ink bg-[#111214] text-white":"ink-1 bg-white text-[#111214]"}`}>{homeViewLabels[view]}</button>)}
        </div>
        <p className="mt-3 text-xs font-semibold text-[var(--muted)]">{homeViewHints[value.homeView]}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="ink hard rounded-[20px] bg-white p-6">
          <h3 className="text-xl font-extrabold">Price and shipping</h3>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Field label="Minimum price" value={value.priceFloor} onChange={priceFloor=>setValue(current=>({...current,priceFloor}))}/>
            <Field label="Maximum price" value={value.priceCeiling} onChange={priceCeiling=>setValue(current=>({...current,priceCeiling}))}/>
          </div>
          <label className="mt-4 block text-xs font-semibold text-[var(--muted)]">Maximum claimed shipping days
            <input type="number" min={1} max={60} value={value.maxShippingDays} onChange={event=>setValue(current=>({...current,maxShippingDays:Number(event.target.value)}))} className="ink-1 mt-2 w-full rounded-[10px] bg-white px-4 py-3 text-base text-[#111214] outline-none focus:shadow-[3px_3px_0_0_#2b31d8]"/>
          </label>
        </div>
        <div className="ink hard rounded-[20px] bg-white p-6">
          <h3 className="text-xl font-extrabold">Evidence priorities</h3>
          <div className="mt-5 flex flex-wrap gap-2">{evidenceOptions.map(option=>
            <button type="button" key={option.key} onClick={()=>toggleArray("evidencePriorities",option.key)} aria-pressed={value.evidencePriorities.includes(option.key)} className={`ink-1 rounded-full px-3 py-2 text-xs font-bold ${value.evidencePriorities.includes(option.key)?"bg-[#2b31d8] text-white":"bg-white text-[#111214]"}`}>{option.label}</button>)}
          </div>
        </div>
      </div>
      <div className="ink hard rounded-[20px] bg-white p-6">
        <h3 className="text-xl font-extrabold">Required evidence level</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">A hard limit, not a nudge: anything weaker than the lowest level you pick is removed from your feed rather than ranked lower. Picking more than one sets the bar at the weakest of them. Pick nothing to keep every record visible.</p>
        <div className="mt-5 flex flex-wrap gap-2">{evidenceLevelOptions.map(option=>
          <button type="button" key={option.key} onClick={()=>toggleRequiredLevel(option.key)} title={option.hint} aria-pressed={value.requiredEvidenceLevels.includes(option.key)} className={`ink-1 rounded-full px-3 py-2 text-xs font-bold ${value.requiredEvidenceLevels.includes(option.key)?"bg-[#2b31d8] text-white":"bg-white text-[#111214]"}`}>{option.label}</button>)}
        </div>
        <p className="mt-3 text-xs font-semibold text-[var(--muted)]">{weakestRequired
          ?`Records weaker than “${weakestRequired.label}” are excluded. ${weakestRequired.hint}.`
          :"No level required — nothing is excluded, and unknown evidence stays visible."}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Selector title="Preferred compounds" options={compounds} selected={value.preferredCompoundSlugs} onToggle={slug=>toggleArray("preferredCompoundSlugs",slug)}/>
        <Selector title="Preferred vendors" options={vendors} selected={value.preferredVendorSlugs} onToggle={slug=>toggleVendor("preferredVendorSlugs",slug)}/>
      </div>
      <div className="ink hard rounded-[20px] bg-white p-6">
        <h3 className="flex items-center gap-2 text-xl font-extrabold"><EyeOff className="size-4 text-[var(--muted)]"/>Hidden vendors</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Records from a hidden vendor are removed from your feed. Tap a vendor again to bring it back — hiding is yours alone and changes nothing about the vendor&rsquo;s public record.</p>
        <div className="mt-5 flex flex-wrap gap-2">{vendors.map(option=>
          <button type="button" key={option.slug} onClick={()=>toggleVendor("hiddenVendorSlugs",option.slug)} aria-pressed={value.hiddenVendorSlugs.includes(option.slug)} className={`ink-1 rounded-full px-3 py-2 text-xs font-bold ${value.hiddenVendorSlugs.includes(option.slug)?"bg-[#d3372c] text-white":"bg-white text-[#111214]"}`}>{value.hiddenVendorSlugs.includes(option.slug)?`${option.name} · hidden`:option.name}</button>)}
        </div>
        {value.hiddenVendorSlugs.length>0&&<p className="mt-3 text-xs font-semibold text-[var(--muted)]">{value.hiddenVendorSlugs.length} vendor{value.hiddenVendorSlugs.length===1?"":"s"} hidden from your feed.</p>}
      </div>
      {error&&<p className="text-sm font-bold text-[#d3372c]">{error}</p>}
      <button type="button" onClick={save} className="ink hard-sm press inline-flex rounded-full bg-[#111214] px-6 py-3 text-sm font-bold text-white">{saved?<><Check className="mr-2 inline size-4"/>Saved</>:"Save preferences"}</button>
    </section>
  </div>;
}
function Field({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}){return <label className="text-xs font-semibold text-[var(--muted)]">{label}<input type="number" min={0} value={value} onChange={event=>onChange(Number(event.target.value))} className="ink-1 mt-2 w-full rounded-[10px] bg-white px-4 py-3 text-base text-[#111214] outline-none focus:shadow-[3px_3px_0_0_#2b31d8]"/></label>}
function Selector({title,options,selected,onToggle}:{title:string;options:Option[];selected:string[];onToggle:(slug:string)=>void}){return <div className="ink hard rounded-[20px] bg-white p-6"><h3 className="text-xl font-extrabold">{title}</h3><div className="mt-5 flex flex-wrap gap-2">{options.map(option=><button type="button" key={option.slug} onClick={()=>onToggle(option.slug)} aria-pressed={selected.includes(option.slug)} className={`ink-1 rounded-full px-3 py-2 text-xs font-bold ${selected.includes(option.slug)?"bg-[#111214] text-white":"bg-white text-[#111214]"}`}>{option.name}</button>)}</div></div>}
