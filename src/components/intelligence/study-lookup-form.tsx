"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { normalizeNctId } from "@/lib/nct-identifier";
import { Pill, UI } from "@/components/intelligence/research-ui";

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
      <label htmlFor={compact ? "trial-id-repeat" : "trial-id-start"} className="mb-2 block text-xs font-extrabold text-[#111214]">
        ClinicalTrials.gov study ID or link
      </label>
      <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-2 sm:flex-row"}>
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
          className={UI.field + " min-w-0 flex-1 font-mono"}
        />
        <Pill type="submit" variant="primary" icon={Search} arrow="right" className={compact ? "w-full" : "sm:self-stretch"}>
          Check evidence
        </Pill>
      </div>
      {error ? <p id={compact ? "trial-error-repeat" : "trial-error-start"} role="alert" className="mt-2 text-sm font-bold text-[#ce403b]">{error}</p> : null}
    </form>
  );
}
