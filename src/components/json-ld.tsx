import type { JsonLd as JsonLdData } from "@/lib/structured-data";

/**
 * Renders a schema.org JSON-LD block.
 *
 * The `<` escape is load-bearing, not decoration: any string that reaches this payload from the
 * database (a vendor name, a compound description) could otherwise close the script element and
 * inject markup. Centralizing the tag here means that escape can never be forgotten at a call site.
 */
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
