import { createHash } from "node:crypto";
import type { SnapshotDiff } from "./types";

export function contentHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedLines(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function computeSnapshotDiff(previousContent: string | null | undefined, currentContent: string): SnapshotDiff {
  const previous = previousContent ?? "";
  const previousHash = previousContent == null ? undefined : contentHash(previous);
  const currentHash = contentHash(currentContent);
  const oldLines = normalizedLines(previous);
  const newLines = normalizedLines(currentContent);
  const oldCounts = new Map<string, number>();
  const newCounts = new Map<string, number>();
  for (const line of oldLines) oldCounts.set(line, (oldCounts.get(line) ?? 0) + 1);
  for (const line of newLines) newCounts.set(line, (newCounts.get(line) ?? 0) + 1);
  const added: string[] = [];
  const removed: string[] = [];
  for (const [line, count] of newCounts) {
    const delta = count - (oldCounts.get(line) ?? 0);
    for (let index = 0; index < Math.max(0, delta); index += 1) added.push(line);
  }
  for (const [line, count] of oldCounts) {
    const delta = count - (newCounts.get(line) ?? 0);
    for (let index = 0; index < Math.max(0, delta); index += 1) removed.push(line);
  }
  return {
    changed: previousHash !== currentHash,
    addedLines: added.length,
    removedLines: removed.length,
    previousHash,
    currentHash,
    summary: {
      previousLength: previous.length,
      currentLength: currentContent.length,
      addedPreview: added.slice(0, 6),
      removedPreview: removed.slice(0, 6),
    },
  };
}
