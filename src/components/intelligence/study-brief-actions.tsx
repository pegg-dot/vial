"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Pill } from "@/components/intelligence/research-ui";

export function StudyBriefActions({ markdown, nctId }: { markdown: string; nctId: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setError(false);
    } catch {
      setCopied(false);
      setError(true);
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "vialgrade-" + nctId.toLowerCase() + "-source-brief.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill variant="secondary" icon={copied ? Check : Copy} onClick={copy}>
        {copied ? "Copied" : "Copy brief"}
      </Pill>
      <Pill variant="ink" icon={Download} onClick={download}>Download brief</Pill>
      {error && <span role="alert" className="text-sm font-bold text-[#ce403b]">Copy unavailable. Download the brief instead.</span>}
    </div>
  );
}
