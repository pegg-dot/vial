"use client";

import { useState } from "react";
import { FlaskConical, LineChart } from "lucide-react";

export function DossierPerspective({ research, analyst }: { research: string; analyst: string }) {
  const [mode, setMode] = useState<"researcher" | "analyst">("researcher");
  return (
    <section aria-label="Research perspective" className="rounded-2xl border border-[#dedee8] bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#29283e]">Questions to investigate</h2>
        <div className="inline-flex rounded-lg bg-[#f5f4f9] p-1 text-xs font-semibold">
          <button type="button" aria-pressed={mode === "researcher"} onClick={() => setMode("researcher")}
            className={"inline-flex items-center gap-1.5 rounded-md px-3 py-2 " + (mode === "researcher" ? "bg-white text-[#4d4291] shadow-sm" : "text-[#7a7a86]")}>
            <FlaskConical className="size-3.5" /> Researcher
          </button>
          <button type="button" aria-pressed={mode === "analyst"} onClick={() => setMode("analyst")}
            className={"inline-flex items-center gap-1.5 rounded-md px-3 py-2 " + (mode === "analyst" ? "bg-white text-[#4d4291] shadow-sm" : "text-[#7a7a86]")}>
            <LineChart className="size-3.5" /> Analyst
          </button>
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-[#5c6070]">{mode === "researcher" ? research : analyst}</p>
      <p className="mt-3 text-xs leading-5 text-[#858895]">Suggested review direction, not a verified scientific finding or investment recommendation.</p>
    </section>
  );
}
