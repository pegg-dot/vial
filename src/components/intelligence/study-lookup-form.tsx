"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { normalizeNctId } from "@/lib/nct-identifier";

/** Input is intentionally local until submission; only an NCT identifier is sent. */
export function StudyLookupForm({ initialId = "", compact = false }: {
  initialId?: string;
  compact?: boolean;
}) {
  const [value, setValue] = useState(initialId);
  const [error, setError] = useState("");
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = normalizeNctId(value);
    if (!id) {
      setError("Enter a study ID such as NCT05804162, or paste its ClinicalTrials.gov study link.");
      return;
    }
    setError("");
    router.push("/intelligence/studies/" + id);
  }

  return (
    <form onSubmit={submit} role="search" className="w-full">
      <label htmlFor={compact ? "trial-id-repeat" : "trial-id-start"} className="mb-2 block text-sm font-semibold text-[#202534]">
        ClinicalTrials.gov study ID or link
      </label>
      <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-2 sm:flex-row"}>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#808394]" aria-hidden="true" />
          <input
            id={compact ? "trial-id-repeat" : "trial-id-start"}
            type="text"
            value={value}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={210}
            placeholder="NCT05804162"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? (compact ? "trial-error-repeat" : "trial-error-start") : undefined}
            onChange={e => { setValue(e.target.value); if (error) setError(""); }}
            className="h-14 w-full rounded-xl border border-[#ced0d9] bg-white pl-12 pr-4 font-mono text-base text-[#1d2333] outline-none transition-colors placeholder:text-[#9598a2] focus:border-[#5f50d6] focus:ring-2 focus:ring-[#5f50d6]/20"
          />
        </div>
        <button type="submit" className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#28234c] px-6 text-sm font-semibold text-white shadow-sm hover:bg-[#44368d] focus-visible:outline-offset-2">
          Check evidence <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      {error ? <p id={compact ? "trial-error-repeat" : "trial-error-start"} role="alert" className="mt-2 text-sm font-medium text-[#a33926]">{error}</p> : null}
    </form>
  );
}
