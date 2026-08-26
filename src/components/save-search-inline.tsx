"use client";

import { BookmarkPlus, Check } from "lucide-react";
import { useCallback, useState } from "react";
import { useMarketplace } from "./marketplace-state";

// Signed out, this used to send the visitor to /login and drop the search on the floor — the same
// intent-loss the Follow button had. It now asks in place and saves the search afterwards.
export function SaveSearchInline({ query }: { query: string }) {
  const { authenticated, promptSignIn } = useMarketplace();
  const [saved, setSaved] = useState(false);

  const save = useCallback(async () => {
    const response = await fetch("/api/v1/saved-searches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `Search: ${query}`.slice(0, 80), query, filters: {}, alertMode: "important" }),
    });
    // 409 is "you already saved this", which is the same outcome from the reader's side.
    if (response.ok || response.status === 409) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    }
  }, [query]);

  function onClick() {
    if (!authenticated) {
      promptSignIn({ reason: `Save this search for "${query}".`, onAuthenticated: save });
      return;
    }
    void save();
  }

  return (
    <button type="button" onClick={onClick} className="ink-1 hard-sm press inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold">
      {saved ? <><Check className="size-3.5" />Saved</> : <><BookmarkPlus className="size-3.5" />Save search</>}
    </button>
  );
}
