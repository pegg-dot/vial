/** Parse an exact public registry identifier or official study URL. */
export function normalizeNctId(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length > 210) return null;
  if (/^NCT\d{8}$/i.test(trimmed)) return trimmed.toUpperCase();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "clinicaltrials.gov" ||
      url.username || url.password || url.port || url.hash) return null;
    const match = /^\/study\/(NCT\d{8})\/?$/i.exec(url.pathname);
    return match ? match[1].toUpperCase() : null;
  } catch {
    return null;
  }
}
