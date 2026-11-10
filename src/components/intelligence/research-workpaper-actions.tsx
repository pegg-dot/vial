"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Pill } from "@/components/intelligence/research-ui";

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
      <Pill variant="secondary" icon={copied ? Check : Copy} onClick={copy}>
        {copied ? "Copied" : "Copy workpaper"}
      </Pill>
      <Pill variant="ink" icon={Download} onClick={download}>Download workpaper</Pill>
      {copyFailed && <p role="alert" className="w-full text-sm font-bold text-[#ce403b]">Clipboard access was unavailable. You can download the workpaper instead.</p>}
    </div>
  );
}
