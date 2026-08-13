/**
 * Display-only cleanup of scraped listing titles.
 *
 * Two problems, both cosmetic, both loud on a card:
 *  1. The vendor's own sales copy rides along in the title — "BPC-157 For Sale",
 *     "(Wholesale ONLY)", "Packs of 5, 10 or 30".
 *  2. The card prints the vial size next to a title that already ends in it, so a buyer reads
 *     "Ipamorelin 2mg 2mg" and reasonably wonders whether we can read.
 *
 * Nothing here touches stored data: the scraped title stays exactly as the vendor published it,
 * so matching, search, exports, and every comparison against the source keep working on the real
 * string. This is only what a person sees.
 */

// Kept narrow on purpose: each pattern is sales boilerplate a vendor appended, never part of a
// product's identity. Anything that could be a real name (a compound, a blend, a batch) is left alone.
const JUNK_PATTERNS: RegExp[] = [
  /\(\s*wholesale\s+only\s*\)/gi,
  /\bwholesale\s+only\b/gi,
  /\bfor\s+sale\b/gi,
  /\bpacks?\s+of\s+\d+(\s*,\s*\d+)*(\s*(?:or|and)\s*\d+)?/gi,
  /\bbuy\s+(?:it\s+)?(?:online|now)\b/gi,
];

const squash = (value: string) => value.toLowerCase().replace(/\s+/g, "");

function tidy(value: string): string {
  return value
    .replace(/\(\s*\)/g, " ") // a parenthetical we just emptied out
    .replace(/\s+([,;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–—|,:]+/, "")
    .replace(/[\s\-–—|,:]+$/, "")
    .trim();
}

/** The product title with the vendor's sales boilerplate removed. */
export function displayProductName(name: string): string {
  let out = name ?? "";
  for (const pattern of JUNK_PATTERNS) out = out.replace(pattern, " ");
  const cleaned = tidy(out);
  // Never hand back nothing: if a title was pure boilerplate, the original is still better.
  return cleaned || (name ?? "");
}

/**
 * Does the title already state this size?
 *
 * Compared with the spaces squeezed out ("10 mg" === "10mg"), and only counted when the match
 * stands on its own — so a 2mg vial titled "Retatrutide 12mg" is not read as already saying "2mg".
 */
export function titleStatesSize(name: string, quantity: string): boolean {
  const size = squash(quantity ?? "");
  if (!size) return false;
  const title = squash(name ?? "");
  for (let i = title.indexOf(size); i !== -1; i = title.indexOf(size, i + 1)) {
    const before = i === 0 ? "" : title[i - 1];
    const after = title[i + size.length] ?? "";
    if (!/[0-9.]/.test(before) && !/[a-z0-9.]/.test(after)) return true;
  }
  return false;
}

/** The size to render beside the title — empty when the title already says it. */
export function displaySize(name: string, quantity: string | null | undefined): string {
  if (!quantity) return "";
  return titleStatesSize(displayProductName(name), quantity) ? "" : quantity;
}

/** Title and size as one string, for page titles, alt text, and structured data. */
export function displayProductTitle(name: string, quantity?: string | null): string {
  const clean = displayProductName(name);
  const size = displaySize(name, quantity);
  return size ? `${clean} ${size}` : clean;
}
