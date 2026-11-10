"use client";

import { useState } from "react";
import { Check, ClipboardCopy, Download } from "lucide-react";
import { Pill } from "@/components/intelligence/research-ui";

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
      <Pill variant="secondary" icon={copied ? Check : ClipboardCopy} onClick={copy}>
        {copied ? "Copied factual audit" : "Copy audit"}
      </Pill>
      <Pill variant="ink" icon={Download} onClick={download}>Export cited Markdown</Pill>
      {error && <span role="status" className="text-xs font-bold text-[#ce403b]">Clipboard unavailable. Use the download instead.</span>}
    </div>
  );
}
