import type { SignupRow, SignupState } from "@/server/digest/signup-overview";

const STATE: Record<SignupState, { label: string; cls: string; title: string }> = {
  confirmed: { label: "Confirmed", cls: "bg-[#e6fbf4] text-[#0b6b60]", title: "Clicked the confirmation link. Gets the monthly update." },
  "confirmation-sent": { label: "Link sent", cls: "bg-[#eef0ff] text-[#2b31d8]", title: "A confirmation link was emailed and has not been clicked. Deleted after 3 days unanswered." },
  waiting: { label: "Waiting", cls: "bg-[#fff3d8] text-[#9b6b22]", title: "Saved before the update email started. Gets one confirmation link when sending is connected." },
};

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });

/** jane.doe@example.org -> j•••@example.org, for staff whose role may not read personal data. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 1 ? "•••" : email[0] + "•••" + email.slice(at);
}

/**
 * The email list as rows. `showAddresses` is false for staff without the privacy:read permission,
 * who see a masked address. `compact` is the overview's short version: address, state, signed up.
 */
export function SignupTable({ rows, showAddresses, compact = false }: { rows: readonly SignupRow[]; showAddresses: boolean; compact?: boolean }) {
  if (rows.length === 0) {
    return <p className="px-5 pb-5 text-sm font-medium text-[var(--muted)]">Nobody is on the list yet. Rows appear the first time someone signs up.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className={"w-full text-left text-sm " + (compact ? "min-w-[380px]" : "min-w-[760px]")} data-testid="signup-table">
        <thead className="border-b-2 border-[#111214]/10 text-[11px] uppercase tracking-[.1em] text-[var(--muted)]">
          <tr>
            <th className="px-5 py-3 font-bold">Email</th>
            <th className="px-5 py-3 font-bold">State</th>
            <th className="px-5 py-3 font-bold">Signed up</th>
            {!compact && <th className="px-5 py-3 font-bold">Confirmed</th>}
            {!compact && <th className="px-5 py-3 font-bold">Last emailed</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#111214]/10">
          {rows.map((row) => {
            const state = STATE[row.state];
            return (
              <tr key={row.id}>
                <td className="max-w-[18rem] truncate px-5 py-2.5 font-bold">{showAddresses ? row.email : maskEmail(row.email)}</td>
                <td className="px-5 py-2.5"><span title={state.title} className={"ink-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-[.08em] " + state.cls}>{state.label}</span></td>
                <td className="whitespace-nowrap px-5 py-2.5 text-xs font-medium tabular-nums text-[var(--muted)]">{compact ? day(row.signedUpAt) : when(row.signedUpAt)}</td>
                {!compact && <td className="whitespace-nowrap px-5 py-2.5 text-xs font-medium tabular-nums text-[var(--muted)]">{row.confirmedAt ? day(row.confirmedAt) : "—"}</td>}
                {!compact && <td className="whitespace-nowrap px-5 py-2.5 text-xs font-medium tabular-nums text-[var(--muted)]">{row.lastEmailedAt ? day(row.lastEmailedAt) : "never"}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
