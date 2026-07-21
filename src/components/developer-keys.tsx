"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Copy, Check } from "lucide-react";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/account/developer/actions";

interface KeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: string;
  last_used_at: string | null;
  created_at: string;
}

const SCOPES = [
  { id: "market:read", label: "Market data (catalog, compounds, vendors)" },
  { id: "signals:read", label: "Opportunity signals" },
  { id: "export:read", label: "Data exports (CSV / JSON)" },
  { id: "feeds:read", label: "Risk-signal feeds" },
];

export function DeveloperKeys({ initialKeys }: { initialKeys: KeyRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["market:read"]);
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const result = await createApiKeyAction({ name, scopes });
      setIssued(result.plaintext);
      setCopied(false);
      setName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    try { await revokeApiKeyAction(id); router.refresh(); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {issued && (
        <div className="rounded-[24px] border border-violet-200 bg-violet-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-violet-700">Copy your key now</p>
          <p className="mt-2 text-xs leading-5 text-violet-900/70">This is the only time the full key is shown. Store it somewhere safe — you can’t see it again.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-xl bg-white px-3 py-2.5 font-mono text-xs">{issued}</code>
            <button onClick={() => { navigator.clipboard?.writeText(issued); setCopied(true); }} className="flex items-center gap-1.5 rounded-xl bg-[#111214] px-3 py-2.5 text-xs font-semibold text-white">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-[24px] border border-black/[.07] bg-white p-6">
        <h2 className="text-lg font-semibold tracking-[-.02em]">Create an API key</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. reporting pipeline)" className="mt-4 w-full rounded-xl border border-black/[.1] px-4 py-2.5 text-sm outline-none focus:border-black/30" />
        <div className="mt-4 space-y-2">
          {SCOPES.map((scope) => (
            <label key={scope.id} className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={scopes.includes(scope.id)} onChange={(e) => setScopes((prev) => e.target.checked ? [...prev, scope.id] : prev.filter((s) => s !== scope.id))} className="size-4 accent-violet-600" />
              <span><span className="font-mono text-xs text-[var(--muted)]">{scope.id}</span> — {scope.label}</span>
            </label>
          ))}
        </div>
        <button onClick={create} disabled={busy || !name.trim()} className="mt-5 rounded-full bg-[#111214] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black/85 disabled:opacity-40">Create key</button>
      </div>

      <div className="rounded-[24px] border border-black/[.07] bg-white p-6">
        <h2 className="text-lg font-semibold tracking-[-.02em]">Your keys</h2>
        <div className="mt-4 space-y-2">
          {initialKeys.map((key) => (
            <div key={key.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--background)] px-4 py-3">
              <div className="flex items-center gap-3">
                <KeyRound className="size-4 text-black/30" />
                <div>
                  <p className="text-sm font-semibold">{key.name}</p>
                  <p className="font-mono text-[11px] text-[var(--muted)]">{key.key_prefix}… · {key.scopes.join(", ") || "no scopes"}{key.last_used_at ? " · used" : " · never used"}</p>
                </div>
              </div>
              {key.status === "active"
                ? <button onClick={() => revoke(key.id)} disabled={busy} className="rounded-full border border-black/[.1] px-4 py-2 text-xs font-semibold transition hover:bg-black/[.03] disabled:opacity-40">Revoke</button>
                : <span className="rounded-full bg-black/[.06] px-3 py-1 text-[10px] font-semibold text-black/50">revoked</span>}
            </div>
          ))}
          {initialKeys.length === 0 && <p className="rounded-2xl bg-[var(--background)] px-4 py-6 text-center text-xs text-[var(--muted)]">No keys yet. Create one above to start calling the API.</p>}
        </div>
      </div>
    </div>
  );
}
