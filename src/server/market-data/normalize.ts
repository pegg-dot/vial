export function normalizeTerm(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function compactTerm(value: string) {
  return normalizeTerm(value).replace(/\s+/g, "");
}

export function trigrams(value: string) {
  const normalized = `  ${compactTerm(value)}  `;
  const grams = new Set<string>();
  for (let index = 0; index <= normalized.length - 3; index += 1) grams.add(normalized.slice(index, index + 3));
  return grams;
}

export function trigramSimilarity(left: string, right: string) {
  const a = trigrams(left);
  const b = trigrams(right);
  if (!a.size && !b.size) return 1;
  let overlap = 0;
  for (const gram of a) if (b.has(gram)) overlap += 1;
  return (2 * overlap) / Math.max(1, a.size + b.size);
}

export function tokenSimilarity(left: string, right: string) {
  const a = new Set(normalizeTerm(left).split(" ").filter(Boolean));
  const b = new Set(normalizeTerm(right).split(" ").filter(Boolean));
  if (!a.size && !b.size) return 1;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / Math.max(1, new Set([...a, ...b]).size);
}

export function combinedSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeTerm(left);
  const normalizedRight = normalizeTerm(right);
  if (normalizedLeft === normalizedRight) return 1;
  if (compactTerm(left) === compactTerm(right)) return 0.98;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return 0.9;
  return Math.min(1, trigramSimilarity(left, right) * 0.72 + tokenSimilarity(left, right) * 0.28);
}
