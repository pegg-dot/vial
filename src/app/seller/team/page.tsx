import { UserPlus, UsersRound } from "lucide-react";
import { Panel, primaryButton, SellerPageHeader, StatusPill } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getSellerContext } from "@/server/seller/ops";
import { inviteTeamMemberAction } from "../actions";

export default async function SellerTeamPage() {
  const principal = await requireSellerPermission("seller:profile:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  return <>
    <SellerPageHeader title="Team" description="Give each teammate only the seller permissions required for operations, finance, support, or ownership." />
    <div className="mt-7 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <Panel title="Members" description={`${context.team.length} seller team records`}>
        <div className="space-y-3">{context.team.map((row) => { const member = row as Record<string, unknown>; return <div key={String(member.id)} className="flex items-center gap-4 rounded-2xl border border-black/[.06] bg-[#fafaf7] p-4"><div className="grid size-11 place-items-center rounded-2xl bg-white"><UsersRound className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate font-medium">{String(member.display_name)}</p><p className="truncate text-xs text-black/40">{String(member.email)} · {String(member.role).replaceAll("_", " ")}</p></div><StatusPill status={String(member.status)} /></div>; })}</div>
      </Panel>
      <Panel title="Invite a teammate" description="Invitations remain seller-scoped and role-specific.">
        <form action={inviteTeamMemberAction} className="space-y-4">
          <label className="block text-sm font-medium">Name<input className="field mt-2" name="displayName" required /></label>
          <label className="block text-sm font-medium">Email<input className="field mt-2" name="email" type="email" required /></label>
          <label className="block text-sm font-medium">Role<select className="field mt-2" name="role" defaultValue="operations"><option value="operations">Operations</option><option value="finance">Finance</option><option value="support">Support</option><option value="owner">Owner</option></select></label>
          <button className={`${primaryButton} w-full`}><UserPlus className="mr-2 size-4" />Send sandbox invitation</button>
        </form>
      </Panel>
    </div>
  </>;
}
