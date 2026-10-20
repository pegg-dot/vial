"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";

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
      <button type="button" onClick={copy} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d8dbe4] bg-white px-4 py-2 text-sm font-semibold text-[#303449] hover:bg-[#f5f5f9]">
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy brief"}
      </button>
      <button type="button" onClick={download} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#28234c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#44368d]">
        <Download className="size-4" /> Download brief
      </button>
      {error && <span role="alert" className="text-sm text-[#a33926]">Copy unavailable. Download the brief instead.</span>}
    </div>
  );
}
