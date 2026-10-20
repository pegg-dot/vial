"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";

export function ResearchWorkpaperActions({ markdown, filename }: { markdown: string; filename: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d9d6e9] bg-white px-4 py-2.5 text-xs font-semibold text-[#4c456e] hover:bg-[#f6f3ff]">
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy workpaper"}
      </button>
      <button type="button" onClick={download} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2f294f] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#493a7b]">
        <Download className="size-4" /> Download workpaper
      </button>
      {copyFailed && <p role="alert" className="w-full text-xs text-[#a33926]">Clipboard access was unavailable. You can download the workpaper instead.</p>}
    </div>
  );
}
