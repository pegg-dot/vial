import {
  Activity,
  DatabaseZap,
  FileCheck2,
  GitBranch,
  GitPullRequestArrow,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Radar,
  ScrollText,
  Gauge,
  CreditCard,
  Landmark,
  PackageCheck,
  RotateCcw,
  Webhook,
  ShieldCheck,
  Boxes,
  Users,
  LifeBuoy,
  MessageSquareWarning,
  SlidersHorizontal,
  ChartNoAxesCombined,
  Bot,
  LockKeyhole,
  FlaskConical,
  MonitorCog,
  ShieldAlert,
  Network,
  Microscope,
  SearchCheck,
  Database,
  BrainCircuit,
  Store,
} from "lucide-react";
import Link from "next/link";
import type { StaffRole } from "@/server/auth/session";
import type { Principal } from "@/server/auth/types";
import { principalHasPermission, type StaffPermission } from "@/server/auth/permissions";
import { logoutAction } from "@/app/admin/actions";

const links: Array<{href:string;label:string;icon:typeof LayoutDashboard;permission?:StaffPermission;group:string}> = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, group: "Market & evidence" },
  { href: "/admin/sources", label: "Source refresh", icon: Activity, group: "Market & evidence" },
  { href: "/admin/review", permission: "review:decide", label: "Review queue", icon: GitPullRequestArrow, group: "Market & evidence" },
  { href: "/admin/quality", label: "Quality", icon: Gauge, group: "Market & evidence" },
  { href: "/admin/entities", permission: "catalog:read", label: "Entity graph", icon: Network, group: "Market & evidence" },
  { href: "/admin/benchmarks", permission: "catalog:read", label: "Benchmarks", icon: Microscope, group: "Market & evidence" },
  { href: "/admin/data-quality", permission: "catalog:read", label: "Data quality", icon: Database, group: "Market & evidence" },
  { href: "/admin/search-quality", permission: "catalog:read", label: "Search quality", icon: SearchCheck, group: "Market & evidence" },
  { href: "/admin/consumer-intelligence", permission: "privacy:read", label: "Consumer intelligence", icon: BrainCircuit, group: "Market & evidence" },
  { href: "/admin/sellers", permission: "commerce:read", label: "Seller onboarding", icon: Store, group: "Legacy · simulation" },
  { href: "/admin/evidence-network", permission: "evidence:read", label: "Evidence network", icon: FlaskConical, group: "Market & evidence" },
  { href: "/admin/laboratories", permission: "laboratories:manage", label: "Laboratories", icon: Microscope, group: "Market & evidence" },
  { href: "/admin/sampling", permission: "evidence:write", label: "Sampling programs", icon: PackageCheck, group: "Market & evidence" },
  { href: "/admin/passports", permission: "evidence:read", label: "Batch passports", icon: Network, group: "Market & evidence" },
  { href: "/admin/report-integrity", permission: "evidence:read", label: "Report integrity", icon: FileCheck2, group: "Market & evidence" },
  { href: "/admin/opportunities", label: "Signals", icon: Lightbulb, group: "Market & evidence" },
  { href: "/admin/commerce", permission: "commerce:read", label: "Commerce", icon: CreditCard, group: "Legacy · simulation" },
  { href: "/admin/underwriting", permission: "commerce:read", label: "Underwriting", icon: ShieldCheck, group: "Legacy · simulation" },
  { href: "/admin/activation", permission: "commerce:read", label: "Activation", icon: SlidersHorizontal, group: "Legacy · simulation" },
  { href: "/admin/provider-events", permission: "commerce:read", label: "Provider events", icon: Webhook, group: "Legacy · simulation" },
  { href: "/admin/settlements", permission: "finance:read", label: "Settlements", icon: Landmark, group: "Legacy · simulation" },
  { href: "/admin/finance", permission: "finance:read", label: "Finance", icon: Landmark, group: "Legacy · simulation" },
  { href: "/admin/returns", permission: "commerce:write", label: "Returns", icon: RotateCcw, group: "Legacy · simulation" },
  { href: "/admin/fulfillment", permission: "commerce:write", label: "Fulfillment", icon: PackageCheck, group: "Legacy · simulation" },
  { href: "/admin/inventory", permission: "commerce:write", label: "Inventory", icon: Boxes, group: "Legacy · simulation" },
  { href: "/admin/risk", permission: "security:read", label: "Risk", icon: ShieldCheck, group: "Legacy · simulation" },
  { href: "/admin/observability", permission: "security:read", label: "Observability", icon: MonitorCog, group: "Platform & trust" },
  { href: "/admin/security", permission: "security:read", label: "Security audit", icon: ShieldAlert, group: "Platform & trust" },
  { href: "/admin/webhooks", permission: "commerce:write", label: "Webhooks", icon: Webhook, group: "Legacy · simulation" },
  { href: "/admin/reconciliation", permission: "finance:read", label: "Reconciliation", icon: Landmark, group: "Legacy · simulation" },
  { href: "/admin/users", permission: "admin:manage", label: "Identity", icon: Users, group: "Platform & trust" },
  { href: "/admin/support", permission: "commerce:read", label: "Support", icon: LifeBuoy, group: "Legacy · simulation" },
  { href: "/admin/moderation", label: "Moderation", icon: MessageSquareWarning, group: "Platform & trust" },
  { href: "/admin/policy", permission: "admin:manage", label: "Policy lab", icon: SlidersHorizontal, group: "Platform & trust" },
  { href: "/admin/fraud", permission: "security:read", label: "Fraud cases", icon: ShieldCheck, group: "Legacy · simulation" },
  { href: "/admin/analytics", permission: "admin:manage", label: "Analytics", icon: ChartNoAxesCombined, group: "Platform & trust" },
  { href: "/admin/agents", permission: "admin:manage", label: "Agent evals", icon: Bot, group: "Platform & trust" },
  { href: "/admin/privacy", permission: "privacy:read", label: "Privacy", icon: LockKeyhole, group: "Platform & trust" },
  { href: "/admin/scenarios", permission: "admin:manage", label: "Scenarios", icon: FlaskConical, group: "Platform & trust" },
  { href: "/admin/traces", label: "Trace graph", icon: GitBranch, group: "Market & evidence" },
  { href: "/admin/publications", label: "Publications", icon: FileCheck2, group: "Market & evidence" },
  { href: "/admin/runs", label: "Run receipts", icon: Radar, group: "Market & evidence" },
  { href: "/admin/ingest", permission: "catalog:write", label: "Manual ingest", icon: DatabaseZap, group: "Market & evidence" },
  { href: "/how-we-check", label: "How we check", icon: ScrollText, group: "Market & evidence" },
];

export function AdminShell({ role, principal, children }: { role: StaffRole; principal: Principal; children: React.ReactNode }) {
  const visibleLinks=links.filter(link=>!link.permission||principalHasPermission(principal,link.permission));
  return (
    <section className="mx-auto max-w-[1540px] px-4 py-6 sm:px-7 sm:py-10">
      <div className="ink hard-lg overflow-hidden rounded-[24px] bg-white lg:grid lg:min-h-[800px] lg:grid-cols-[260px_1fr]">
        <aside className="border-b-2 border-[#111214] bg-[#111214] p-5 text-white lg:border-b-0 lg:border-r-2 lg:p-6">
          <div className="flex items-start justify-between gap-4 lg:block">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#8fa2ff]">VIAL control plane</p>
              <p className="mt-2 text-xl font-extrabold tracking-[-.02em]">Market operations</p>
            </div>
            <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase text-white/80">{role}</span>
          </div>
          <nav className="mt-7 space-y-5">
            {["Market & evidence","Platform & trust","Legacy · simulation"].map((group)=>{
              const groupLinks=visibleLinks.filter(l=>l.group===group);
              if(!groupLinks.length)return null;
              return (
                <div key={group}>
                  <p className={`px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] ${group.startsWith("Legacy")?"text-amber-300/80":"text-white/35"}`}>{group}{group.startsWith("Legacy")?" — not in the buyer product":""}</p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
                    {groupLinks.map(({ href, label, icon: Icon }) => (
                      <Link key={href} href={href} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-white/65 hover:bg-white/10 hover:text-white">
                        <Icon className="size-4" />{label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
          <form action={logoutAction} className="mt-5 border-t border-white/15 pt-5">
            <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10 hover:text-white"><LogOut className="size-4" />Sign out</button>
          </form>
        </aside>
        <div className="min-w-0 bg-[var(--background)] p-5 sm:p-8 lg:p-10">{children}</div>
      </div>
    </section>
  );
}
