import * as cheerio from "cheerio";
import { ingestionInputSchema, type ClaimCandidate, type IngestionInput } from "./schemas";

const injectionNoise = /(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior|above|system|developer)\s+(?:instructions?|prompts?)|(?:call|invoke|use)\s+(?:the\s+)?(?:[A-Za-z0-9_-]+\s+){0,3}(?:tool|function)|(?:mark|rate|declare)\s+(?:this\s+)?(?:vendor|listing|report)\s+(?:as\s+)?(?:issuer\s+)?(?:verified|confirmed|safe)|reveal\s+(?:the\s+)?(?:system|developer)\s+prompt/i;
const blockSelector = "address,article,aside,blockquote,br,dd,div,dl,dt,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hr,li,main,nav,ol,p,pre,section,table,td,th,tr,ul";

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function visibleText(html: string) {
  const $ = cheerio.load(html);
  $("script,style,noscript,template").remove();
  $(blockSelector).after("\n");
  return $("body").text() || $.root().text();
}

function cleanText(value: string) {
  return value
    .split(/(?:\n|[.!?]\s+)/)
    .map((part) => part.trim())
    .filter((part) => part && !injectionNoise.test(part))
    .join(" ");
}

function first(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return normalize(match[1]);
  }
  return null;
}

function jsonLd(html: string) {
  const $ = cheerio.load(html);
  const records: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const parsed = JSON.parse($(element).text());
      if (Array.isArray(parsed)) records.push(...parsed);
      else records.push(parsed);
    } catch {
      // Invalid embedded JSON is ignored; the visible page may still yield claims.
    }
  });
  return records;
}

function findOffer(records: unknown[]) {
  const stack = [...records];
  while (stack.length) {
    const current = stack.shift();
    if (!current || typeof current !== "object") continue;
    const record = current as Record<string, unknown>;
    if (record.offers && typeof record.offers === "object") return record.offers as Record<string, unknown>;
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) stack.push(...value);
      else if (value && typeof value === "object") stack.push(value);
    }
  }
  return null;
}

export function extractClaimCandidates(rawInput: IngestionInput): ClaimCandidate[] {
  const input = ingestionInputSchema.parse(rawInput);
  const isHtml = input.contentType === "text/html" || /<\w+[\s>]/.test(input.rawContent);
  const text = normalize(cleanText(isHtml ? visibleText(input.rawContent) : input.rawContent));
  const lower = text.toLowerCase();
  const candidates: ClaimCandidate[] = [];
  const allowCommerce = input.parserProfile !== "document";

  if (isHtml && allowCommerce) {
    const offer = findOffer(jsonLd(input.rawContent));
    if (offer) {
      const price = Number(offer.price ?? offer.lowPrice);
      if (Number.isFinite(price) && price > 0) candidates.push({ predicate: "price", value: price, confidence: 0.98, rationale: "Structured product offer exposed a numeric price.", riskLevel: "standard" });
      if (typeof offer.availability === "string") {
        const availability = offer.availability.toLowerCase();
        if (availability.includes("instock")) candidates.push({ predicate: "availability", value: "In stock", confidence: 0.96, rationale: "Structured offer marked the listing in stock.", riskLevel: "standard" });
        else if (availability.includes("outofstock")) candidates.push({ predicate: "availability", value: "Unavailable", confidence: 0.96, rationale: "Structured offer marked the listing out of stock.", riskLevel: "standard" });
      }
    }
  }

  if (allowCommerce && !candidates.some((candidate) => candidate.predicate === "price")) {
    const priceText = first(text, [/(?:current\s+price|sale\s+price|price)\s*[:\-]?\s*\$\s*([0-9]+(?:\.[0-9]{1,2})?)/i, /\$\s*([0-9]+(?:\.[0-9]{1,2})?)/]);
    const price = priceText ? Number(priceText) : Number.NaN;
    if (Number.isFinite(price) && price > 0) candidates.push({ predicate: "price", value: price, confidence: 0.86, rationale: "A labeled currency amount was extracted from the source text.", riskLevel: "standard" });
  }

  if (allowCommerce && !candidates.some((candidate) => candidate.predicate === "availability")) {
    if (/\b(?:out of stock|sold out|unavailable)\b/i.test(text)) candidates.push({ predicate: "availability", value: "Unavailable", confidence: 0.92, rationale: "The source explicitly described the listing as unavailable.", riskLevel: "standard" });
    else if (/\blow stock\b/i.test(text)) candidates.push({ predicate: "availability", value: "Low stock", confidence: 0.9, rationale: "The source explicitly described inventory as low.", riskLevel: "standard" });
    else if (/\bin stock\b/i.test(text)) candidates.push({ predicate: "availability", value: "In stock", confidence: 0.9, rationale: "The source explicitly described the listing as in stock.", riskLevel: "standard" });
  }

  const shipping = allowCommerce
    ? first(text, [/(?:shipping|ships?|delivery|delivers?)\s*(?:in|within|:)\s*([0-9]+\s*(?:-|–|to)\s*[0-9]+\s*(?:business\s*)?days)/i, /([0-9]+\s*(?:-|–|to)\s*[0-9]+\s*(?:business\s*)?days)\s*(?:shipping|delivery)/i])
    : null;
  if (shipping) candidates.push({ predicate: "shipping", value: shipping.replace(/\bto\b/i, "–"), confidence: 0.84, rationale: "A bounded shipping-time claim was extracted from the source.", riskLevel: "standard" });

  const batch = first(text, [/(?:batch|lot)(?:\s+(?:number|code|id))?\s*[:#-]?\s*([A-Z0-9][A-Z0-9._-]{3,31})\b/i]);
  if (batch) candidates.push({ predicate: "batchCode", value: batch.toUpperCase(), confidence: 0.88, rationale: "The source labeled an alphanumeric batch or lot identifier.", riskLevel: "material" });

  const reportDate = first(text, [/(?:report|coa|certificate|tested|analysis)\s*(?:date|issued|on)?\s*[:\-]?\s*((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2})/i, /(?:report|coa|certificate|tested|analysis)\s*(?:date|issued|on)?\s*[:\-]?\s*(20\d{2}-\d{2}-\d{2})/i]);
  if (reportDate) candidates.push({ predicate: "reportDate", value: reportDate, confidence: 0.83, rationale: "A date associated with a report or analysis was extracted.", riskLevel: "material" });

  const issuer = first(text, [/(?:issued by|report issuer|laboratory|lab|tested by)\s*[:\-]?\s*([A-Z][A-Za-z0-9&.,' -]{2,80}?)(?=\s+(?:report|certificate|batch|lot|date|price|shipping|confirmed|$))/i]);
  if (issuer) candidates.push({ predicate: "reportIssuer", value: issuer, confidence: 0.72, rationale: "A named laboratory or report issuer was extracted from nearby source text.", riskLevel: "material" });

  if (lower.includes("issuer confirmed") || lower.includes("confirmed by the issuing lab") || lower.includes("report verified by laboratory") || /report\s+(?:is\s+)?confirmed\s*[:\-]?\s*(?:yes|true)/i.test(text)) {
    candidates.push({ predicate: "reportConfirmed", value: true, confidence: 0.62, rationale: "The source claims issuer confirmation, which requires independent reviewer validation before publication.", riskLevel: "high-impact" });
  } else if (/report\s+(?:is\s+)?confirmed\s*[:\-]?\s*(?:no|false)/i.test(text)) {
    candidates.push({ predicate: "reportConfirmed", value: false, confidence: 0.68, rationale: "The source explicitly states that issuer confirmation is absent.", riskLevel: "material" });
  }

  const strongest = new Map<string, ClaimCandidate>();
  for (const candidate of candidates) {
    const existing = strongest.get(candidate.predicate);
    if (!existing || candidate.confidence > existing.confidence) strongest.set(candidate.predicate, candidate);
  }
  return [...strongest.values()];
}
