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
  return <form action={submit} className="ink hard grid gap-3 rounded-[18px] bg-white p-5">
    {fields.map(field=><label key={field.name} className="grid gap-1 text-xs font-extrabold uppercase tracking-[.06em] text-[var(--muted)]">{field.label}<input name={field.name} type={field.type||"text"} defaultValue={String(defaults[field.name]??"")} className="ink-1 rounded-[10px] bg-white px-3 py-2 text-sm font-medium text-[#111214] outline-none focus:shadow-[2px_2px_0_0_#2b31d8]" required /></label>)}
    <button className="ink hard-sm press inline-flex min-h-11 items-center justify-center rounded-full bg-[#111214] px-4 text-sm font-bold text-white">{actionLabel}</button>
    {status&&<p className="text-xs font-semibold text-[var(--muted)]">{status}</p>}
  </form>;
}
