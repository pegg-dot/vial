// Minimal RFC-4180 CSV serializer for bounded data exports. In-house, no dependency.
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const isText = typeof value === "string" || typeof value === "object";
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  // Neutralize spreadsheet formula injection: a text cell that a spreadsheet would
  // evaluate as a formula (starts with = + - @ tab CR) gets a leading apostrophe so it
  // renders as literal text. Only applied to text — genuine numbers stay numbers.
  if (isText && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(row[column])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
