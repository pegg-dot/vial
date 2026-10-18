"use client";

import { useState } from "react";
import { Check, ClipboardCopy, Download } from "lucide-react";

/** Browser-only export of a factual source register. No server write or research profile. */
export function ResearchAuditExport({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setError(false);
    } catch {
      setError(true);
      setCopied(false);
    }
  }
  function download() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "vialgrade-cagrilintide-study-audit.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-full border border-[#111214]/25 bg-white px-4 py-2.5 text-xs font-bold hover:bg-[#f7f7f4]">
        {copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
        {copied ? "Copied factual audit" : "Copy audit"}
      </button>
      <button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-full bg-[#111214] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#333]">
        <Download className="size-4" /> Export cited Markdown
      </button>
      {error && <span role="status" className="text-xs text-[#9e3d11]">Clipboard unavailable. Use the download instead.</span>}
    </div>
  );
}
