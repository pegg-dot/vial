import { extractText, getDocumentProxy } from "unpdf";
import { getDatabase } from "@/server/db/client";
import { normalizeCoaCode } from "./index";

// Reading a certificate PDF for the one thing that makes it checkable: its verification key.
//
// Vendors hand buyers a PDF. Until now there was nowhere to put one — you had to find the code
// inside it and retype that — which asked the least technical reader on the site to do the parsing
// by hand. This does it for them.
//
// The file is NEVER stored. It is read into memory, scanned for a key, and dropped. There is no
// bucket, no row, no path on disk: an uploaded document is a question, not a record, and keeping
// other people's lab reports would be a liability with no matching use.
//
// Text-layer PDFs only. A COA that is a photograph of a page carries no text and no amount of
// parsing will find a code in it — that case is reported honestly rather than guessed at, because
// guessing here means answering a question about the wrong certificate.

/** Generated lab PDFs are small. Anything larger is not a COA and should not be parsed. */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/** Bounds the work one request can ask for. A Janoshik COA is one page. */
const MAX_PAGES = 10;

/** Key-shaped tokens we will offer to the index from one document. */
const MAX_CANDIDATES = 40;

const VERIFY_URL = /https?:\/\/(?:www\.)?verify\.janoshik\.com\/tests\/[^\s"'<>)]+/i;

export interface DocumentScan {
  /** A full verify URL found in the text — the strongest result, because it identifies one record. */
  url: string | null;
  /** Tokens shaped like a verification key, in the order they appear. Candidates, not answers. */
  codes: string[];
  pages: number;
  /** False when the document carried no text layer at all, which is the scanned-photo case. */
  hasText: boolean;
}

/**
 * Pull the verification key candidates out of a certificate PDF.
 *
 * A COA is full of tokens that look like a key — batch numbers, lot codes, order references — so
 * this deliberately does NOT pick one. It returns the URL if there is one (unambiguous), and
 * otherwise every candidate, leaving the choice to whoever can check them against real records.
 */
export async function scanCoaDocument(bytes: Uint8Array): Promise<DocumentScan> {
  const doc = await getDocumentProxy(bytes);
  const pages = Math.min(doc.numPages ?? 0, MAX_PAGES);
  const { text } = await extractText(doc, { mergePages: true });
  const body = typeof text === "string" ? text : String(text ?? "");
  if (!body.trim()) return { url: null, codes: [], pages, hasText: false };

  const url = VERIFY_URL.exec(body)?.[0] ?? null;
  // A key inside the URL is already accounted for by the URL itself.
  const withoutUrl = url ? body.replace(url, " ") : body;
  const codes: string[] = [];
  for (const token of withoutUrl.split(/[^A-Za-z0-9]+/)) {
    const code = normalizeCoaCode(token);
    if (code && !codes.includes(code)) codes.push(code);
  }
  return { url, codes, pages, hasText: true };
}

/**
 * Which of the candidate tokens is a certificate we actually hold.
 *
 * This is what makes reading a bare code out of a PDF safe. Rather than guessing which token is the
 * key — a batch number and a verification key are the same shape — every candidate is offered to
 * the index, and the index decides. A token nothing matches is not a key we can use, so it is not
 * used. Matching the tail of verify_url as well as the extracted column mirrors the lookup the
 * text path uses, so a document and a typed code resolve to the same record.
 */
export async function firstIndexedCode(codes: readonly string[]): Promise<string | null> {
  const candidates = codes.slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) return null;
  try {
    const db = await getDatabase();
    // One query for the whole candidate set, not one per candidate. A crafted document can carry
    // forty key-shaped tokens, and asking the database forty separate questions about one upload is
    // how a parser becomes an amplifier.
    const r = await db.query<{ verify_key: string | null; verify_url: string }>(
      `SELECT verify_key, UPPER(verify_url) AS verify_url
         FROM lab_test_records
        WHERE verify_key = ANY($1::text[])
           OR EXISTS (SELECT 1 FROM unnest($1::text[]) c WHERE UPPER(verify_url) LIKE '%' || c)`,
      [candidates],
    );
    if (r.rows.length === 0) return null;
    const keys = new Set(r.rows.map((row) => row.verify_key).filter((k): k is string => Boolean(k)));
    const urls = r.rows.map((row) => row.verify_url);
    // Document order decides, so the same PDF always resolves to the same certificate.
    return candidates.find((code) => keys.has(code) || urls.some((u) => u.endsWith(code))) ?? null;
  } catch {
    return null;
  }
}
