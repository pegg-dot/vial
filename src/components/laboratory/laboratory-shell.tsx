"use client";
import { Activity, Beaker, Blocks, Boxes, Braces, ClipboardCheck, FileCheck2, FlaskConical, Gauge, LayoutDashboard, Menu, Microscope, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/wordmark";

const groups = [
  { label: "Operate", links: [["/lab", "Overview", LayoutDashboard], ["/lab/onboarding", "Onboarding", ShieldCheck], ["/lab/orders", "Test orders", ClipboardCheck], ["/lab/samples", "Samples", Boxes], ["/lab/custody", "Chain of custody", Activity]] },
  { label: "Analyze", links: [["/lab/methods", "Methods", FlaskConical], ["/lab/runs", "Analytical runs", Microscope], ["/lab/reports", "Reports", FileCheck2], ["/lab/quality", "Quality", Gauge]] },
  { label: "Integrate", links: [["/lab/developer", "Developer", Braces], ["/passports", "Public passports", Blocks], ["/research", "Evidence library", Beaker]] },
] as const;

function Nav({ close }: { close?: () => void }) {
  const pathname = usePathname();
  return <nav aria-label="Laboratory workspace" className="space-y-7">{groups.map(group => <div key={group.label}><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-black/35">{group.label}</p><div className="space-y-1">{group.links.map(([href,label,Icon]) => { const active=pathname===href||(href!=="/lab"&&pathname.startsWith(`${href}/`)); return <Link key={href} href={href} onClick={close} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${active?"bg-black text-white":"text-black/55 hover:bg-black/[.045] hover:text-black"}`}><Icon className="size-4"/>{label}</Link>; })}</div></div>)}</nav>;
}

export function LaboratoryShell({ children, name, role, completion, accreditation }: { children: React.ReactNode; name: string; role: string; completion: number; accreditation: string }) {
  const [open,setOpen]=useState(false);
  return <div className="min-h-screen bg-[#f7f7f4]">
    <header className="sticky top-0 z-50 border-b border-black/[.06] bg-[rgba(247,247,244,.9)] backdrop-blur-xl lg:hidden"><div className="flex h-16 items-center px-5"><Wordmark/><span className="ml-3 rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-800">Laboratory</span><button className="ml-auto grid size-10 place-items-center rounded-full border bg-white" aria-label={open?"Close laboratory navigation":"Open laboratory navigation"} onClick={()=>setOpen(v=>!v)}>{open?<X className="size-4"/>:<Menu className="size-4"/>}</button></div></header>
    {open&&<div className="fixed inset-x-0 top-16 z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-b bg-[#f7f7f4] p-5 shadow-xl lg:hidden"><Nav close={()=>setOpen(false)}/></div>}
    <aside className="fixed inset-y-0 left-0 hidden w-[268px] border-r border-black/[.06] bg-[#f2f2ee] p-5 lg:flex lg:flex-col"><div className="flex items-center justify-between px-2 py-2"><Wordmark/><span className="rounded-full bg-black px-2 py-1 text-[9px] font-bold uppercase tracking-[.18em] text-white">Lab</span></div><div className="mt-6 rounded-[22px] border border-black/[.06] bg-white p-4"><p className="truncate font-semibold">{name}</p><p className="mt-1 text-xs capitalize text-black/45">{role.replaceAll("_"," ")}</p><div className="mt-4 flex items-center justify-between text-[11px]"><span className="text-black/45">Onboarding</span><b>{completion}%</b></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[.07]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-violet-500" style={{width:`${completion}%`}}/></div><p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-cyan-800">{accreditation.replaceAll("_"," ")}</p></div><div className="mt-7 flex-1 overflow-y-auto pr-1"><Nav/></div></aside>
    <main className="lg:pl-[268px]"><div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</div></main>
  </div>;
}
