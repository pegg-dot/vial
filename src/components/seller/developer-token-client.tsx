"use client";

import { Copy, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { primaryButton, secondaryButton, StatusPill } from "./seller-ui";

export type TokenRow = { id: string; name: string; token_prefix: string; scopes: string[] | string; last_used_at?: string | null; revoked_at?: string | null; created_at: string };

function scopes(value: string[] | string) {
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value) as unknown; return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
}

export function DeveloperTokenClient({ initialTokens }: { initialTokens: TokenRow[] }) {
  const [tokens, setTokens] = useState<TokenRow[]>(initialTokens);
  const [created, setCreated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    const response = await fetch("/api/v1/seller/tokens", { cache: "no-store" });
    if (response.ok) setTokens((await response.json()).tokens ?? []);
  }
  async function submit(formData: FormData) {
    setLoading(true); setError(null); setCreated(null);
    const selected = formData.getAll("scopes").map(String);
    const response = await fetch("/api/v1/seller/tokens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: String(formData.get("name") ?? "Seller MCP"), scopes: selected }) });
    const body = await response.json();
    if (!response.ok) setError(body.error ?? "Token creation failed");
    else { setCreated(body.token); await load(); }
    setLoading(false);
  }
  return <div className="space-y-6">
    <div className="rounded-[24px] border border-black/[.07] bg-[#fafaf7] p-5">
      <form action={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">Token name<input className="field mt-2" name="name" defaultValue="Seller operator" required /></label>
        {["seller:read", "catalog:read", "catalog:propose", "evidence:read", "evidence:propose"].map((scope) => <label key={scope} className="flex items-center gap-2 rounded-2xl border border-black/[.06] bg-white p-3 text-sm"><input type="checkbox" name="scopes" value={scope} defaultChecked={scope !== "evidence:propose"} />{scope}</label>)}
        <button disabled={loading} className={`${primaryButton} sm:col-span-2 sm:w-fit`}>{loading ? <><Loader2 className="mr-2 size-4 animate-spin" />Creating</> : <><KeyRound className="mr-2 size-4" />Create scoped token</>}</button>
      </form>
      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      {created && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">Copy this token now. It will not be shown again.</p><div className="mt-3 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-white px-3 py-2 text-xs">{created}</code><button type="button" className={secondaryButton} onClick={() => navigator.clipboard.writeText(created)} aria-label="Copy seller API token"><Copy className="size-4" /></button></div></div>}
    </div>
    <div className="space-y-3">{tokens.length ? tokens.map((token) => <div key={token.id} className="flex flex-col gap-3 rounded-2xl border border-black/[.07] bg-white p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-medium">{token.name}</p><p className="mt-1 font-mono text-xs text-black/40">{token.token_prefix}••••••••</p><div className="mt-2 flex flex-wrap gap-1">{scopes(token.scopes).map((scope) => <span key={scope} className="rounded-full bg-black/[.045] px-2 py-1 text-[10px]">{scope}</span>)}</div></div><StatusPill status={token.revoked_at ? "revoked" : "active"} /></div>) : <p className="text-sm text-black/45">No API tokens yet.</p>}</div>
  </div>;
}
