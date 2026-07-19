"use client";
import { Bookmark, Home, Search, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
const items=[{href:"/",label:"Home",icon:Home},{href:"/search",label:"Search",icon:Search},{href:"/for-you",label:"For you",icon:Sparkles},{href:"/watchlist",label:"Saved",icon:Bookmark},{href:"/account",label:"Account",icon:UserRound}];
export function MobileRetentionNav({authenticated}:{authenticated:boolean}){const path=usePathname();if(!authenticated)return null;return <nav aria-label="Mobile account navigation" className="fixed inset-x-3 bottom-3 z-50 rounded-[22px] border border-black/10 bg-[rgba(255,255,255,.92)] p-1.5 shadow-[0_16px_50px_rgba(0,0,0,.16)] backdrop-blur-xl md:hidden"><div className="grid grid-cols-5">{items.map(item=>{const active=path===item.href||path.startsWith(`${item.href}/`);const Icon=item.icon;return <Link key={item.href} href={item.href} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold ${active?"bg-black text-white":"text-black/45"}`}><Icon className="size-4"/><span>{item.label}</span></Link>})}</div></nav>}
