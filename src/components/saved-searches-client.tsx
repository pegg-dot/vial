"use client";
import { Bell, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { alertModeError, createSearch, deleteSearch, runSearch, saveAlertMode, settleAlertModeList } from "@/lib/saved-search-actions";
import { withRowFlag, withRowMessage } from "@/lib/saved-search-feedback";
import type { SavedSearch } from "@/server/consumer-intelligence/types";

/**
 * Every handler here talks to the network, and a `fetch` REJECTS rather than resolves when there is
 * no answer at all — offline, DNS gone, a server replaced mid-deploy. These were written as
 * `await fetch(...)` followed by `if (response.ok) … else …`, so a rejection skipped both branches:
 * the optimistic value stayed on screen although nothing was stored, the busy flag was never
 * cleared (leaving the control disabled for the rest of the page's life), and the rejection went
 * unhandled with nothing shown.
 *
 * The requests now live in `@/lib/saved-search-actions`, where each one resolves for every outcome —
 * success, refusal, and no answer. That is what makes the cleanup below unskippable; the `try` /
 * `finally` on top of it is a second line, not the only one.
 */
export function SavedSearchesClient({initial}:{initial:SavedSearch[]}){
  const[searches,setSearches]=useState(initial);
  const[name,setName]=useState("");
  const[query,setQuery]=useState("");
  const[alertMode,setAlertMode]=useState<"off"|"important"|"all">("important");
  const[creating,setCreating]=useState(false);
  const[createError,setCreateError]=useState<string|null>(null);
  // Per row, not one shared slot: two rows can be in flight at once. See withRowFlag.
  const[running,setRunning]=useState<Record<string,boolean>>({});
  const[savingAlert,setSavingAlert]=useState<Record<string,boolean>>({});
  const[resultCounts,setResultCounts]=useState<Record<string,number>>({});
  const[rowErrors,setRowErrors]=useState<Record<string,string>>({});

  const markSavingAlert=(id:string,busy:boolean)=>setSavingAlert(current=>withRowFlag(current,id,busy));
  const markRunning=(id:string,busy:boolean)=>setRunning(current=>withRowFlag(current,id,busy));
  const showRowError=(id:string,message:string|null)=>setRowErrors(current=>withRowMessage(current,id,message));

  async function changeAlertMode(item:SavedSearch,next:SavedSearch["alertMode"]){
    if(next===item.alertMode||savingAlert[item.id])return;
    const previous=item.alertMode;
    markSavingAlert(item.id,true);
    showRowError(item.id,null);
    setSearches(current=>current.map(entry=>entry.id===item.id?{...entry,alertMode:next}:entry));
    try{
      // Both halves of the settlement are decided in one place, so a failure cannot leave the
      // optimistic value on screen and cannot fail to say why. See settleAlertModeList.
      const result=await saveAlertMode(item.id,next);
      setSearches(current=>settleAlertModeList(current,item.id,previous,result));
      showRowError(item.id,alertModeError(result,previous));
    }finally{
      markSavingAlert(item.id,false);
    }
  }

  async function create(){
    if(creating)return;
    if(name.trim().length<2||!query.trim()){setCreateError("Give the search a name of at least two characters and something to search for.");return}
    setCreating(true);
    setCreateError(null);
    try{
      const result=await createSearch({name,query,alertMode});
      if(result.status==="created"){
        if(!result.search){setCreateError("The search was saved but the response could not be read. Reload to see it.");return}
        setSearches(current=>[result.search!,...current]);
        setName("");
        setQuery("");
        return;
      }
      // The reachable refusal is 409 — a UNIQUE(user_id, name) collision. It was swallowed by an
      // `if (response.ok)` with no `else`, so the inputs kept their values, nothing appeared, and
      // the button read as broken. Keep the values (the reader needs to edit the name) and say why.
      setCreateError(result.message);
    }finally{
      setCreating(false);
    }
  }

  async function remove(item:SavedSearch){
    showRowError(item.id,null);
    const result=await deleteSearch(item.id);
    if(result.status==="deleted"){setSearches(current=>current.filter(entry=>entry.id!==item.id));return}
    showRowError(item.id,result.message);
  }

  async function run(item:SavedSearch){
    if(running[item.id])return;
    markRunning(item.id,true);
    showRowError(item.id,null);
    try{
      const result=await runSearch(item.id);
      if(result.status==="ran"){
        if(result.count===null){showRowError(item.id,"The search ran but its result could not be read. Reload to see the count.");return}
        setResultCounts(current=>({...current,[item.id]:result.count!}));
        return;
      }
      showRowError(item.id,result.message);
    }finally{
      markRunning(item.id,false);
    }
  }

  return <div className="grid gap-6 lg:grid-cols-[.72fr_1.28fr]"><section className="ink hard-violet rounded-[20px] bg-[#111214] p-6 text-white"><Plus className="size-5 text-white/40"/><h2 className="mt-7 text-3xl font-extrabold">Save a market question</h2><p className="mt-3 text-sm leading-6 text-white/50">Saved searches preserve the question and can later generate focused alerts when the normalized index changes.</p><div className="mt-7 space-y-3"><input value={name} onChange={event=>setName(event.target.value)} aria-label="Saved search name" placeholder="Name this search" className="w-full rounded-[12px] border border-white/15 bg-white/[.07] px-4 py-3 font-medium outline-none"/><input value={query} onChange={event=>setQuery(event.target.value)} aria-label="Saved search query" placeholder="BPC157, copper tripeptide…" className="w-full rounded-[12px] border border-white/15 bg-white/[.07] px-4 py-3 font-medium outline-none"/><select aria-label="Saved search alert mode" value={alertMode} onChange={event=>setAlertMode(event.target.value as typeof alertMode)} className="w-full rounded-[12px] border border-white/15 bg-[#1d1e21] px-4 py-3 font-medium"><option value="off">No alerts</option><option value="important">Important changes only</option><option value="all">All reviewed changes</option></select><button type="button" onClick={create} disabled={creating} className="ink-1 press w-full rounded-[12px] bg-white px-4 py-3 text-sm font-bold text-[#111214] disabled:opacity-60">{creating?"Saving":"Save search"}</button>{createError&&<p role="status" className="text-xs font-bold text-[#ff9d95]">{createError}</p>}</div></section><section><div className="grid gap-3">{searches.map(item=><article key={item.id} className="ink-1 hard rounded-[18px] bg-white p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-extrabold">{item.name}</h3><label className="ink-1 inline-flex items-center gap-1 rounded-full bg-[#f0edff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#6d5dfc]"><Bell className="size-3"/><select aria-label={`Alert mode for ${item.name}`} value={item.alertMode} disabled={Boolean(savingAlert[item.id])} onChange={event=>changeAlertMode(item,event.target.value as SavedSearch["alertMode"])} className="bg-transparent font-bold uppercase tracking-[.12em] text-[#6d5dfc] outline-none disabled:opacity-60"><option value="off">off</option><option value="important">important</option><option value="all">all</option></select></label></div><p className="mt-2 font-mono text-sm text-[var(--muted)]">{item.query}</p><p className="mt-3 text-xs text-[var(--muted)]">Last result count: {resultCounts[item.id]??item.lastResultCount}{item.lastRunAt?` · Run ${new Date(item.lastRunAt).toLocaleString()}`:""}</p>{rowErrors[item.id]&&<p role="status" className="mt-2 text-xs font-bold text-[#d3372c]">{rowErrors[item.id]}</p>}</div><div className="flex gap-2"><Link href={`/search?q=${encodeURIComponent(item.query)}`} className="ink-1 hard-sm press rounded-full bg-white px-4 py-2 text-xs font-bold">Open</Link><button type="button" onClick={()=>run(item)} disabled={Boolean(running[item.id])} className="ink hard-sm press rounded-full bg-[#111214] px-4 py-2 text-xs font-bold text-white"><Play className="mr-1 inline size-3"/>{running[item.id]?"Running":"Run"}</button><button type="button" onClick={()=>remove(item)} aria-label={`Delete ${item.name}`} className="ink-1 hard-sm press grid size-9 place-items-center rounded-full bg-white text-[var(--muted)]"><Trash2 className="size-3.5"/></button></div></div></article>)}{searches.length===0&&<div className="rounded-[20px] border-2 border-dashed border-[#111214]/30 p-14 text-center"><h3 className="text-xl font-extrabold">No saved searches yet</h3><p className="mt-2 text-sm font-medium text-[var(--muted)]">Save a repeated market question so VialGrade can preserve and rerun it.</p></div>}</div></section></div>;
}
