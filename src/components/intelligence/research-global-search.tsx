"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, X } from "lucide-react";
import { RESEARCH_SUBJECTS, RESEARCH_THEMES } from "@/lib/research-explorer";

export function ResearchGlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(value => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      field.current?.focus();
    } else if (!open && element.open) element.close();
  }, [open]);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? RESEARCH_SUBJECTS.filter(item =>
      [item.name, item.family, item.mechanism, item.referenceLabel, ...item.alternativeNames, item.sampleTrial || "",
        RESEARCH_THEMES.find(t => t.id === item.theme)?.name || ""]
        .some(value => value.toLowerCase().includes(term)))
      .slice(0, 8) : RESEARCH_SUBJECTS.filter(item => item.sampleTrial).slice(0, 5);
  }, [query]);
  // An exact source identifier belongs to the verifier, not the compound index.
  const identifier = /^(?:NCT\d{8}|(?:PMID|CID)\s?\d{1,10})$/i.test(query.trim()) ? query.trim().toUpperCase() : null;
  const verifyHref = identifier ? "/intelligence/verify?ref=" + encodeURIComponent(identifier) : null;
  function close() { setOpen(false); setQuery(""); }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Search VialGrade research"
        className="ink-1 hidden h-10 min-w-[185px] items-center gap-2 rounded-full bg-white px-3.5 text-left text-xs font-medium text-[#62656b] hover:bg-[#f4f4f2] lg:flex">
        <Search className="size-4" /><span className="flex-1">Search research</span><kbd className="ink-1 rounded-md bg-[#f5f5f4] px-1.5 text-[10px] font-bold">⌘K</kbd>
      </button>
      <button type="button" aria-label="Search VialGrade research" onClick={() => setOpen(true)}
        className="ink-1 grid size-10 place-items-center rounded-full bg-white hover:bg-[#f4f4f2] lg:hidden">
        <Search className="size-4" />
      </button>
      <dialog ref={dialog} onClose={close}
        onCancel={event => { event.preventDefault(); close(); }}
        onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); close(); } }}
        onClick={event => { if (event.target === event.currentTarget) close(); }}
        aria-label="Search compounds and sources"
        className="m-auto max-h-[88dvh] w-[min(94vw,640px)] overflow-y-auto rounded-2xl border-2 border-[#111214] bg-white p-0 text-[#111214] shadow-[8px_8px_0_#111214]/50 backdrop:bg-black/50">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b-2 border-[#111214] bg-white p-4">
          <Search className="size-5 shrink-0 text-[#2b31d8]" />
          <input ref={field} aria-label="Search compound name, alias or study ID" autoComplete="off" type="search" value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && (results[0] || verifyHref)) {
                event.preventDefault();
                window.location.assign(results[0] ? "/intelligence/explore/" + results[0].slug : verifyHref!);
              }
            }}
            placeholder="Compound, alternate name, or linked NCT..."
            className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-base outline-none placeholder:text-[#737780]" />
          <button type="button" onClick={close} className="ink-1 grid size-9 shrink-0 place-items-center rounded-full" aria-label="Close search"><X className="size-4" /></button>
        </div>
        <div className="px-4 py-5">
          {verifyHref && (
            <Link href={verifyHref} onClick={close}
              className="ink-1 mb-4 flex items-center gap-3 rounded-xl bg-[#eafff2] px-4 py-3 hover:bg-[#d9f7e6]">
              <div className="min-w-0 flex-1">
                <p className="text-base font-extrabold">Check {identifier} in the source register</p>
                <p className="mt-0.5 text-xs text-[#4f6a58]">Exact identifier lookup · says what the record does and does not show</p>
              </div>
              <ArrowUpRight className="size-5 shrink-0 text-[#1f7d60]" />
            </Link>
          )}
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#2b31d8]">{query.trim() ? "Matching research records" : "Selected trial examples"}</p>
          {results.length ? (
            <ul className="mt-3 space-y-2">
              {results.map(item => (
                <li key={item.slug}>
                  <Link href={"/intelligence/explore/" + item.slug} onClick={close}
                    className="ink-1 flex items-center gap-3 rounded-xl bg-white px-4 py-3 hover:bg-[#eef0ff]">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-extrabold">{item.name}</p>
                      <p className="mt-0.5 truncate text-xs text-[#686b73]">{item.sampleTrial || item.referenceLabel} · {item.family}</p>
                    </div>
                    <ArrowUpRight className="size-5 shrink-0 text-[#2b31d8]" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="py-7 text-sm text-[#676b72]">No record in the current 16-compound starter library. Try an alternate name.</p>}
          <Link href="/intelligence/market#browse" onClick={close}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#2b31d8] hover:underline">
            Browse the complete research market <ArrowUpRight className="size-4" />
          </Link>
          <p className="mt-3 text-xs text-[#666971]">Searches cover the 16-compound starter index, not the full scientific literature or trial registry.</p>
        </div>
      </dialog>
    </>
  );
}

const PRIMARY_MOBILE = [
  { href: "/intelligence/market", label: "Market", note: "Find compounds and research records" },
  { href: "/intelligence/market#browse", label: "Compounds", note: "Search the entire library" },
  { href: "/intelligence/verify", label: "Verify", note: "Check an exact ID in the Pexiganan pilot" },
  { href: "/intelligence/desk", label: "Research Desk", note: "Examine a source-backed question" },
] as const;
const MORE_MOBILE = [
  { href: "/intelligence/compare?subjects=magainin-2%2Cpexiganan", label: "Compare", note: "See two source files together" },
  { href: "/intelligence/grading", label: "How we check", note: "Understand A/B/C research-file coverage" },
  { href: "/intelligence#trial-lookup", label: "Open a trial", note: "Look up an NCT registration" },
  { href: "/intelligence/organizations", label: "Study sponsors", note: "Names found in selected trial records" },
  { href: "/intelligence/providers", label: "Supplier documents", note: "Read company-published QC claims" },
  { href: "/intelligence/materials", label: "Sample report checks", note: "Compare the lot IDs on two documents" },
] as const;
export function ResearchMobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(value => !value)}
        aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}
        className="ink-1 grid size-10 shrink-0 place-items-center rounded-full bg-white xl:hidden">
        {open ? <X className="size-4" /> : <span className="text-[11px] font-extrabold">Menu</span>}
      </button>
      {open && (
        <nav aria-label="Mobile research links" className="absolute left-0 right-0 top-full z-50 max-h-[calc(100dvh-90px)] overflow-y-auto border-b-2 border-[#111214] bg-[var(--background)] px-5 py-4 shadow-lg xl:hidden">
          <div className="mx-auto grid max-w-[1320px] gap-1">
            <Link onClick={() => setOpen(false)} href="/intelligence"
              className="rounded-xl px-4 py-3 text-sm font-extrabold hover:bg-black/[.06]">Home</Link>
            <p className="px-4 pt-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#2b31d8]">Start with</p>
            {PRIMARY_MOBILE.map(item => (
              <Link key={item.href} onClick={() => setOpen(false)} href={item.href} aria-label={item.label}
                className="rounded-xl px-4 py-2.5 hover:bg-black/[.06]">
                <span className="block text-sm font-extrabold">{item.label}</span>
                <span className="block text-xs text-[#64676e]">{item.note}</span>
              </Link>
            ))}
            <p className="px-4 pt-3 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#2b31d8]">Dig deeper</p>
            {MORE_MOBILE.map(item => (
              <Link key={item.href} onClick={() => setOpen(false)} href={item.href} aria-label={item.label}
                className="rounded-xl px-4 py-2.5 hover:bg-black/[.06]">
                <span className="block text-sm font-extrabold">{item.label}</span>
                <span className="block text-xs text-[#64676e]">{item.note}</span>
              </Link>
            ))}
            <Link onClick={() => setOpen(false)} href="/login"
              className="mt-2 border-t border-black/10 px-4 py-3 text-sm font-bold">Existing account</Link>
          </div>
        </nav>
      )}
    </>
  );
}
