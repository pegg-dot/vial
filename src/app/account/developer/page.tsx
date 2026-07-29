import type { Metadata } from "next";
import { requirePrincipal } from "@/server/auth/principal";
import { listApiKeys } from "@/server/api-access/keys";
import { DeveloperKeys } from "@/components/developer-keys";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Developer — API keys" };
export const dynamic = "force-dynamic";

export default async function DeveloperPage() {
  const principal = await requirePrincipal({ accountTypes: ["customer", "seller"] });
  const keys = await listApiKeys(principal.id);
  return (
    <main className="mx-auto max-w-4xl px-5 py-14">
      <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Programmatic access</p>
      <h1 className="mt-3 text-5xl font-extrabold tracking-[-.06em]">Developer</h1>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">Read VIAL&rsquo;s published, review-gated evidence graph over a versioned, rate-limited API. Keys are scoped and revocable; the API is read-only and never exposes commerce, personal, or unpublished data.</p>

      <div className="mt-9">
        <DeveloperKeys initialKeys={keys.map((k) => ({ ...k, scopes: k.scopes as string[] }))} />
      </div>

      <section className="ink mt-8 overflow-hidden rounded-[20px] bg-[#111214] p-6 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#8fa2ff]">Quickstart</p>
        <h2 className="mt-3 text-xl font-extrabold tracking-[-.03em]">Call the API</h2>
        <pre className="mt-4 overflow-x-auto rounded-[12px] bg-black/40 p-4 text-xs leading-6 text-white/85"><code>{`curl -H "Authorization: Bearer vial_pk_…" \\
  ${siteUrl}/api/public/v1/catalog

# CSV export
curl -H "Authorization: Bearer vial_pk_…" \\
  "${siteUrl}/api/public/v1/export?dataset=signals&format=csv"`}</code></pre>
        <p className="mt-4 text-xs text-white/50">Full contract: <a href="/api/openapi.json" className="underline">/api/openapi.json</a> · Rate limit: 120 requests / minute per key.</p>
      </section>
    </main>
  );
}
