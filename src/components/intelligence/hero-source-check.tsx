"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SearchCheck } from "lucide-react";
import { normalizeNctId } from "@/lib/nct-identifier";

/**
 * The home page's main action. It used to look like a text field but was a link to the Pexiganan
 * pilot verifier, which cannot check an arbitrary trial or a pasted study link. Now it is a real
 * field that sends each kind of input to the door that can answer it:
 *   - an NCT number or ClinicalTrials.gov study link -> the live study lookup (works for any real trial)
 *   - anything else (PMID, CID, a typo) -> the verifier, which explains what it can and cannot check
 * Only the identifier text is used in the destination URL, never stored.
 */
export function HeroSourceCheck() {
  const [value, setValue] = useState("");
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = value.trim().slice(0, 210);
    if (!text) { router.push("/intelligence/verify"); return; }
    const nct = normalizeNctId(text);
    router.push(nct
      ? "/intelligence/studies/" + nct
      : "/intelligence/verify?ref=" + encodeURIComponent(text.slice(0, 80)));
  }

  return (
    <form onSubmit={submit} role="search" aria-label="Check an exact source ID"
      className="ink hard group flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left sm:px-5">
      <SearchCheck aria-hidden="true" className="size-5 shrink-0 text-[#2b31d8]" />
      <label htmlFor="hero-source-id" className="sr-only">Study ID, study link, PubMed ID or PubChem ID</label>
      <input id="hero-source-id" type="text" value={value} onChange={event => setValue(event.target.value)}
        autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={210}
        placeholder="Study ID or link"
        className="min-h-10 min-w-0 flex-1 bg-transparent text-sm font-medium text-[#111214] outline-none placeholder:text-[#111214]/60 sm:text-base" />
      <button type="submit" className="shrink-0 rounded-xl bg-[#2b31d8] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#201bb5]">Check it</button>
    </form>
  );
}
