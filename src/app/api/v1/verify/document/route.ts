import { NextResponse } from "next/server";
import { runVerification, type VerifyResult } from "@/server/verify";
import { scanCoaDocument, firstIndexedCode, MAX_DOCUMENT_BYTES } from "@/server/verify/coa-document";
import { getRequestContext } from "@/server/auth/request-context";
import { consumeRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Drop the PDF the vendor sent you.
//
// The upload's job is narrow on purpose: find the verification key in the document, then hand it to
// the same resolver a typed code goes through. One code path means an uploaded certificate and a
// typed one can never disagree.
//
// The file is read into memory, scanned, and dropped. Nothing is written anywhere.
//
// Parsing an untrusted document is the most expensive and most attackable thing this API does, so
// it is bounded on every axis available: content type, byte ceiling before a single byte is parsed,
// page ceiling inside the parser, its own function timeout, and a rate limit a third of the text
// endpoint's. A PDF parser is a large surface, and the answer to that is to let very little reach
// it, very slowly.
const RATE = { bucket: "verify-document-ip", limit: 6, windowSeconds: 60 };

function unreadable(reason: string, note: string): VerifyResult {
  return {
    query: "the document you uploaded", kind: "nothing", verdict: "info",
    headline: reason, summary: note, signals: [],
    link: { href: "https://janoshik.com/verify", label: "Verify at Janoshik" },
  };
}

export async function POST(req: Request) {
  const { ipHash } = await getRequestContext();
  const limit = await consumeRateLimit({ ...RATE, key: ipHash });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "That's a lot of documents at once — give it a minute and try again." },
      { status: 429, headers: { "retry-after": String(RATE.windowSeconds) } },
    );
  }

  // Refuse on the declared length before reading the body, so an oversized upload costs us the
  // header and nothing else.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_DOCUMENT_BYTES * 1.1) {
    return NextResponse.json({ error: "That file is too large — certificates are usually well under 5 MB." }, { status: 413 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const candidate = form.get("file");
    if (candidate instanceof File) file = candidate;
  } catch {
    return NextResponse.json({ error: "Couldn't read that upload." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "Attach a PDF certificate to check." }, { status: 400 });
  if (file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "That file is too large — certificates are usually well under 5 MB." }, { status: 413 });
  }
  // The extension is the reader's word for it; the magic number is the file's. Both must agree
  // before the bytes reach a parser.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf = bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (!isPdf) {
    return NextResponse.json(
      { error: "That doesn't look like a PDF. If your certificate is a photo or a screenshot, open it and type the verification code instead — we can't read text out of an image." },
      { status: 415 },
    );
  }

  let scan;
  try {
    scan = await scanCoaDocument(bytes);
  } catch {
    return NextResponse.json(unreadable(
      "We couldn't read that PDF",
      "The file opened but we couldn't get any text out of it. If it's a scan or a photo of a certificate, open it and type the verification code in the box above instead.",
    ));
  }

  if (!scan.hasText) {
    return NextResponse.json(unreadable(
      "That PDF has no text in it",
      "It's almost certainly a scan or a photo, which means there's nothing for us to read. Open it, find the verification code or link printed on the certificate, and paste that in the box above.",
    ));
  }

  // A URL identifies exactly one record, so it wins. Otherwise the index decides which of the
  // key-shaped tokens is actually a key — never a guess at which token looks most like one.
  const indexed = scan.url ? null : await firstIndexedCode(scan.codes);
  const query = scan.url ?? indexed;
  if (!query) {
    return NextResponse.json(unreadable(
      "No verification code in that certificate",
      "We read the document but found no Janoshik verification link or code we recognise. A certificate you cannot verify at the issuing lab is not evidence of anything — check for a QR code or a verify link on the page, and paste that here.",
    ));
  }

  return NextResponse.json(await runVerification(query), { headers: { "cache-control": "private, no-store" } });
}
