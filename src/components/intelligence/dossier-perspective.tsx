"use client";

import { useState } from "react";
import { FlaskConical, LineChart } from "lucide-react";
import { Quiet, UI } from "@/components/intelligence/research-ui";

// The desk's "Brief emphasis" toggle: one thin pill track, the pressed half in ink.
const TOGGLE = "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3.5 transition-colors ";
const toggleClass = (active: boolean) => TOGGLE + (active ? "bg-[#111214] text-white" : "text-[var(--muted)] hover:bg-[#eef0ff]");

export function DossierPerspective({ research, analyst }: { research: string; analyst: string }) {
  const [mode, setMode] = useState<"researcher" | "analyst">("researcher");
  return (
    <Quiet as="section" ariaLabel="Research perspective">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className={UI.h4}>Questions to investigate</h3>
        <div className="ink-1 inline-flex rounded-full bg-white p-0.5 text-xs font-extrabold">
          <button type="button" aria-pressed={mode === "researcher"} onClick={() => setMode("researcher")} className={toggleClass(mode === "researcher")}>
            <FlaskConical className="size-3.5" aria-hidden="true" /> Researcher
          </button>
          <button type="button" aria-pressed={mode === "analyst"} onClick={() => setMode("analyst")} className={toggleClass(mode === "analyst")}>
            <LineChart className="size-3.5" aria-hidden="true" /> Analyst
          </button>
        </div>
      </div>
      <p className={UI.bodyInk + " mt-4 leading-7"}>{mode === "researcher" ? research : analyst}</p>
      <p className={UI.small + " mt-3"}>Suggested review direction, not a verified scientific finding or investment recommendation.</p>
    </Quiet>
  );
}
