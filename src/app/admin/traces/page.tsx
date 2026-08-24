import { requireStaff } from "@/server/auth/session";
import { getTraceRoots } from "@/server/intelligence/repository";

export const dynamic = "force-dynamic";
export const metadata = { title: "Traces" };

// The causal record: what happened, and what it caused.
//
// AGENTS.md asks that "every downstream metric, alert, and opportunity must retain the upstream
// root event". This is where that is legible. One root — a fixture advanced, a refresh triggered —
// and beneath it every event that followed, in order, with the actor who caused it.
//
// It is the answer to the only question that matters when a published number is challenged: where
// did this come from. Not "the data was updated", but this source, this version, this diff, this
// approval, by this person, at this time.

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });

export default async function TracesPage() {
  await requireStaff();
  const roots = await getTraceRoots(30);

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-10 sm:px-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2b31d8]">Provenance</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">What caused what.</h1>
      <p className="mt-4 max-w-[64ch] text-[15px] leading-7 text-[var(--muted)]">
        Each block is one root cause and everything that followed from it. When a published figure is
        challenged, this is the answer — not that the data was updated, but which source, which version,
        which diff, approved by whom.
      </p>

      <div className="mt-8 grid gap-5">
        {roots.length === 0 ? (
          <div className="ink hard rounded-[18px] bg-white p-8">
            <p className="text-lg font-extrabold">No traces yet.</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              A trace begins the moment a source is re-read or a fixture advanced. Nothing has caused anything yet.
            </p>
          </div>
        ) : roots.map((root) => (
          <article key={root.id} data-root-event={root.eventType} className="ink hard rounded-[18px] bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-mono text-sm font-extrabold text-[#2b31d8]">{root.eventType}</p>
              <span className="text-xs font-semibold text-[var(--muted)] tabular-nums">{when(root.occurredAt)}</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
              {root.entityType}{root.entityId ? ` · ${root.entityId}` : ""} · by {root.actor}
            </p>

            {/* The root is the header above; listing it again as the first child said the same thing
                twice and made the page ambiguous to read (and to assert on). What follows a cause is
                the interesting part. */}
            <ol className="mt-4 grid gap-2 border-l-2 border-[#111214] pl-4">
              {root.events.filter((event) => event.id !== root.id).map((event) => (
                <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[13px] font-bold">{event.eventType}</span>
                  <span className="text-xs text-[var(--muted)]">{event.entityType}</span>
                  <span className="ml-auto text-xs text-[var(--muted)] tabular-nums">{when(event.occurredAt)}</span>
                </li>
              ))}
            </ol>

            {root.alertCount + root.opportunityCount > 0 ? (
              <p className="mt-4 flex flex-wrap gap-2 text-[11px] font-extrabold uppercase tracking-wide">
                {root.alertCount > 0 ? <span className="ink-1 rounded-full bg-[#fff3e0] px-2.5 py-1 text-[#b26a00]">{root.alertCount} alert{root.alertCount === 1 ? "" : "s"}</span> : null}
                {root.opportunityCount > 0 ? <span className="ink-1 rounded-full bg-[#eef0ff] px-2.5 py-1 text-[#2b31d8]">{root.opportunityCount} opportunit{root.opportunityCount === 1 ? "y" : "ies"}</span> : null}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
