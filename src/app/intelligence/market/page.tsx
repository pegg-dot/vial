import { permanentRedirect } from "next/navigation";

// One directory. The research library (theme rail, shelves, the explorer) lives on /compounds now;
// a deep link's filters (?theme=, ?q=…) travel with it.
export default async function ResearchMarketRedirect({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value == null ? [] : [value]) params.append(key, v);
  }
  const query = params.toString();
  permanentRedirect("/compounds" + (query ? "?" + query : ""));
}
