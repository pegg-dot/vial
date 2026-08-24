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
        <div className="ink hard rounded-[20px] bg-[#eef0ff] p-5">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#2b31d8]">Copy your key now</p>
          <p className="mt-2 text-xs leading-5 text-[#111214]/70">This is the only time the full key is shown. Store it somewhere safe — you can’t see it again.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="ink-1 flex-1 overflow-x-auto rounded-[10px] bg-white px-3 py-2.5 font-mono text-xs">{issued}</code>
            <button onClick={() => { navigator.clipboard?.writeText(issued); setCopied(true); }} className="ink hard-sm press inline-flex items-center gap-1.5 rounded-[10px] bg-[#111214] px-3 py-2.5 text-xs font-bold text-white">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="ink hard rounded-[20px] bg-white p-6">
        <h2 className="text-lg font-extrabold tracking-[-.02em]">Create an API key</h2>
        {/* A placeholder is not a label: it is unreadable to a screen reader as a name and it
            disappears the moment someone types, so anyone who looks away loses what the field was
            for. The visible placeholder stays as a hint; the accessible name is explicit. */}
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Key name" placeholder="Key name (e.g. reporting pipeline)" className="ink-1 mt-4 w-full rounded-[10px] bg-white px-4 py-2.5 text-sm font-medium outline-none focus:shadow-[3px_3px_0_0_#2b31d8]" />
        <div className="mt-4 space-y-2">
          {SCOPES.map((scope) => (
            <label key={scope.id} className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={scopes.includes(scope.id)} onChange={(e) => setScopes((prev) => e.target.checked ? [...prev, scope.id] : prev.filter((s) => s !== scope.id))} className="size-4 accent-[#2b31d8]" />
              <span><span className="font-mono text-xs text-[var(--muted)]">{scope.id}</span> — {scope.label}</span>
            </label>
          ))}
        </div>
        <button onClick={create} disabled={busy || !name.trim()} className="ink hard-sm press mt-5 inline-flex rounded-full bg-[#111214] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">Create key</button>
      </div>

      <div className="ink hard rounded-[20px] bg-white p-6">
        <h2 className="text-lg font-extrabold tracking-[-.02em]">Your keys</h2>
        <div className="mt-4 space-y-2">
          {initialKeys.map((key) => (
            <div key={key.id} className="ink-1 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[var(--background)] px-4 py-3">
              <div className="flex items-center gap-3">
                <KeyRound className="size-4 text-[#2b31d8]" />
                <div>
                  <p className="text-sm font-semibold">{key.name}</p>
                  <p className="font-mono text-[11px] text-[var(--muted)]">{key.key_prefix}… · {key.scopes.join(", ") || "no scopes"}{key.last_used_at ? " · used" : " · never used"}</p>
                </div>
              </div>
              {key.status === "active"
                ? <button onClick={() => revoke(key.id)} disabled={busy} className="ink-1 hard-sm press rounded-full bg-white px-4 py-2 text-xs font-bold disabled:opacity-40">Revoke</button>
                : <span className="ink-1 rounded-full bg-[var(--background)] px-3 py-1 text-[10px] font-bold uppercase text-[var(--muted)]">revoked</span>}
            </div>
          ))}
          {initialKeys.length === 0 && <p className="ink-1 rounded-[12px] bg-[var(--background)] px-4 py-6 text-center text-xs font-medium text-[var(--muted)]">No keys yet. Create one above to start calling the API.</p>}
        </div>
      </div>
    </div>
  );
}
