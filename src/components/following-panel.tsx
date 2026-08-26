"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, BellOff, FlaskConical, Store } from "lucide-react";

export interface FollowedEntity {
  entityType: "compound" | "vendor";
  entitySlug: string;
  name: string;
  /** One line of live context, so the list is worth looking at rather than a set of bookmarks. */
  detail: string;
}

// Following was write-only. `getPersonalizedMarket` has always returned `data.follows` and no page
// has ever rendered it, so a person who followed five vendors had no way to see the five, no way to
// stop following one without hunting down each vendor page, and no confirmation the feature was on.
export function FollowingPanel({ initial }: { initial: FollowedEntity[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function unfollow(item: FollowedEntity) {
    const key = `${item.entityType}:${item.entitySlug}`;
    setBusy(key);
    const response = await fetch("/api/v1/follows", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entityType: item.entityType, entitySlug: item.entitySlug, followed: false }),
    });
    if (response.ok) {
      setItems((current) => current.filter((entry) => `${entry.entityType}:${entry.entitySlug}` !== key));
      void fetch("/api/v1/decision-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType: "unfollowed", subjectType: item.entityType, subjectId: item.entitySlug }),
      });
    }
    setBusy(null);
  }

  if (items.length === 0) {
    return (
      <div className="ink hard rounded-[18px] bg-white p-6">
        <p className="text-sm font-bold">You aren&rsquo;t following anything yet.</p>
        <p className="mt-2 max-w-lg text-sm font-medium leading-6 text-[var(--muted)]">
          Follow a compound or a vendor and every reviewed price move and evidence change on it is waiting here and
          in your alerts next time you look.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link href="/compounds" className="ink hard-sm press inline-flex items-center gap-1.5 rounded-full bg-[#111214] px-4 py-2.5 text-sm font-bold text-white">Browse compounds <ArrowUpRight className="size-3.5" /></Link>
          <Link href="/vendors" className="ink-1 hard-sm press inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-bold">Browse vendors <ArrowUpRight className="size-3.5" /></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const key = `${item.entityType}:${item.entitySlug}`;
        const Icon = item.entityType === "compound" ? FlaskConical : Store;
        const href = item.entityType === "compound" ? `/compounds/${item.entitySlug}` : `/vendors/${item.entitySlug}`;
        return (
          <div key={key} className="ink hard flex items-start gap-3 rounded-[16px] bg-white p-4">
            <span className={`ink grid size-10 shrink-0 place-items-center rounded-[11px] text-white ${item.entityType === "compound" ? "bg-[#6d5dfc]" : "bg-[#111214]"}`}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <Link href={href} className="group flex items-center gap-1 font-extrabold tracking-[-.01em]">
                <span className="truncate">{item.name}</span>
                <ArrowUpRight className="size-3.5 shrink-0 text-[var(--muted)] transition group-hover:text-[#111214]" />
              </Link>
              <p className="mt-0.5 truncate text-xs font-medium text-[var(--muted)]">{item.detail}</p>
            </div>
            <button
              onClick={() => unfollow(item)}
              disabled={busy === key}
              title={`Stop following ${item.name}`}
              aria-label={`Stop following ${item.name}`}
              className="ink-1 shrink-0 rounded-full bg-white p-2 text-[var(--muted)] transition hover:bg-[#fff1f0] hover:text-[#d3372c] disabled:opacity-50"
            >
              <BellOff className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
