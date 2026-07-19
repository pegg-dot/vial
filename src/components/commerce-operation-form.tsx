"use client";
import { useState } from "react";

export function CommerceOperationForm({ endpoint, fields, actionLabel, defaults = {} }: { endpoint: string; fields: Array<{name:string;label:string;type?:string}>; actionLabel:string; defaults?:Record<string,string|number> }) {
  const [status,setStatus]=useState("");
  async function submit(formData:FormData){
    setStatus("Running…");
    const body:Record<string,unknown>={...defaults};
    for(const field of fields){const value=String(formData.get(field.name)||"");body[field.name]=field.type==="number"?Number(value):value;}
    const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    const json=await response.json();
    setStatus(response.ok?`Completed: ${json.status||json.id||"ok"}`:`Error: ${json.error||"failed"}`);
    if(response.ok) setTimeout(()=>location.reload(),350);
  }
  return <form action={submit} className="grid gap-3 rounded-[22px] border border-black/[.07] bg-white p-5">
    {fields.map(field=><label key={field.name} className="grid gap-1 text-xs font-semibold text-[var(--muted)]">{field.label}<input name={field.name} type={field.type||"text"} defaultValue={String(defaults[field.name]??"")} className="rounded-xl border border-black/10 px-3 py-2 text-sm font-normal text-black" required /></label>)}
    <button className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white">{actionLabel}</button>
    {status&&<p className="text-xs text-[var(--muted)]">{status}</p>}
  </form>;
}
