/**
 * "Recently updated" strip for /intelligence.
 *
 * Every entry is a surface whose editorial review date is already committed
 * in this repo. The date means "VialGrade last reviewed this page's source
 * file", NOT "a trial changed" and NOT a claim that the science moved. Live
 * registry fields are deliberately not read here: the landing page makes no
 * outbound request, and a source's own publication date (for example a sponsor
 * statement) is not a VialGrade update.
 */
import { MAGAININ_PEXIGANAN_CASE } from "@/lib/research-guided-case";
import { PEXIGANAN_REVIEW_DATE } from "@/lib/pexiganan-evidence-network";
import { FILE_GRADE_CURATION_DATE } from "@/lib/research-file-grade";
import { MATERIAL_REVIEW_DATE } from "@/lib/research-materials";

export type RecentUpdate = {
  id: string;
  title: string;
  /** ISO calendar date, YYYY-MM-DD. */
  date: string;
  href: string;
  note: string;
};

export const RECENT_UPDATE_ENTRIES: readonly RecentUpdate[] = [
  {
    id: "pexiganan-passport", title: "Pexiganan evidence passport", date: PEXIGANAN_REVIEW_DATE,
    href: "/intelligence/passports/pexiganan",
    note: "Identifier snapshot re-checked against PubChem and NIH records.",
  },
  {
    id: "magainin-pexiganan-case", title: "Magainin 2 and Pexiganan guided example", date: MAGAININ_PEXIGANAN_CASE.updatedAt,
    href: "/intelligence/cases/magainin-pexiganan",
    note: "Source lineage reviewed.",
  },
  {
    id: "source-file-coverage", title: "Source-file coverage method", date: FILE_GRADE_CURATION_DATE,
    href: "/intelligence/grading",
    note: "Coverage checks reviewed across the starter set.",
  },
  {
    id: "material-records", title: "Material record checks", date: MATERIAL_REVIEW_DATE,
    href: "/intelligence/materials?subject=pexiganan",
    note: "Report-to-lot requirements reviewed.",
  },
];

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for a real calendar day written exactly as YYYY-MM-DD. */
export function isIsoCalendarDay(value: string): boolean {
  const m = ISO_DAY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * Newest first, ties by id so order is stable. Entries with a malformed or
 * future date are dropped rather than shown with a guessed date.
 */
export function recentlyUpdated(
  entries: readonly RecentUpdate[] = RECENT_UPDATE_ENTRIES,
  options: { limit?: number; today?: string } = {},
): RecentUpdate[] {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const limit = options.limit ?? 4;
  return entries
    .filter(e => isIsoCalendarDay(e.date) && e.date <= today)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit));
}

/** "Oct 19, 2026", fixed to UTC and en-US so server and client agree. */
export function formatUpdateDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
