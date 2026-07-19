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

const links: Array<{href:string;label:string;icon:typeof LayoutDashboard;permission?:StaffPermission}> = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/sources", label: "Source refresh", icon: Activity },
  { href: "/admin/review", permission: "review:decide", label: "Review queue", icon: GitPullRequestArrow },
  { href: "/admin/quality", label: "Quality", icon: Gauge },
  { href: "/admin/entities", permission: "catalog:read", label: "Entity graph", icon: Network },
  { href: "/admin/benchmarks", permission: "catalog:read", label: "Benchmarks", icon: Microscope },
  { href: "/admin/data-quality", permission: "catalog:read", label: "Data quality", icon: Database },
  { href: "/admin/search-quality", permission: "catalog:read", label: "Search quality", icon: SearchCheck },
  { href: "/admin/consumer-intelligence", permission: "privacy:read", label: "Consumer intelligence", icon: BrainCircuit },
  { href: "/admin/sellers", permission: "commerce:read", label: "Seller onboarding", icon: Store },
  { href: "/admin/evidence-network", permission: "evidence:read", label: "Evidence network", icon: FlaskConical },
  { href: "/admin/laboratories", permission: "laboratories:manage", label: "Laboratories", icon: Microscope },
  { href: "/admin/sampling", permission: "evidence:write", label: "Sampling programs", icon: PackageCheck },
  { href: "/admin/passports", permission: "evidence:read", label: "Batch passports", icon: Network },
  { href: "/admin/report-integrity", permission: "evidence:read", label: "Report integrity", icon: FileCheck2 },
  { href: "/admin/opportunities", label: "Signals", icon: Lightbulb },
  { href: "/admin/commerce", permission: "commerce:read", label: "Commerce", icon: CreditCard },
  { href: "/admin/underwriting", permission: "commerce:read", label: "Underwriting", icon: ShieldCheck },
  { href: "/admin/activation", permission: "commerce:read", label: "Activation", icon: SlidersHorizontal },
  { href: "/admin/provider-events", permission: "commerce:read", label: "Provider events", icon: Webhook },
  { href: "/admin/settlements", permission: "finance:read", label: "Settlements", icon: Landmark },
  { href: "/admin/finance", permission: "finance:read", label: "Finance", icon: Landmark },
  { href: "/admin/returns", permission: "commerce:write", label: "Returns", icon: RotateCcw },
  { href: "/admin/fulfillment", permission: "commerce:write", label: "Fulfillment", icon: PackageCheck },
  { href: "/admin/inventory", permission: "commerce:write", label: "Inventory", icon: Boxes },
  { href: "/admin/risk", permission: "security:read", label: "Risk", icon: ShieldCheck },
  { href: "/admin/observability", permission: "security:read", label: "Observability", icon: MonitorCog },
  { href: "/admin/security", permission: "security:read", label: "Security audit", icon: ShieldAlert },
  { href: "/admin/webhooks", permission: "commerce:write", label: "Webhooks", icon: Webhook },
  { href: "/admin/reconciliation", permission: "finance:read", label: "Reconciliation", icon: Landmark },
  { href: "/admin/users", permission: "admin:manage", label: "Identity", icon: Users },
  { href: "/admin/support", permission: "commerce:read", label: "Support", icon: LifeBuoy },
  { href: "/admin/moderation", label: "Moderation", icon: MessageSquareWarning },
  { href: "/admin/policy", permission: "admin:manage", label: "Policy lab", icon: SlidersHorizontal },
  { href: "/admin/fraud", permission: "security:read", label: "Fraud cases", icon: ShieldCheck },
  { href: "/admin/analytics", permission: "admin:manage", label: "Analytics", icon: ChartNoAxesCombined },
  { href: "/admin/agents", permission: "admin:manage", label: "Agent evals", icon: Bot },
  { href: "/admin/privacy", permission: "privacy:read", label: "Privacy", icon: LockKeyhole },
  { href: "/admin/scenarios", permission: "admin:manage", label: "Scenarios", icon: FlaskConical },
  { href: "/admin/traces", label: "Trace graph", icon: GitBranch },
  { href: "/admin/publications", label: "Publications", icon: FileCheck2 },
  { href: "/admin/runs", label: "Run receipts", icon: Radar },
  { href: "/admin/ingest", permission: "catalog:write", label: "Manual ingest", icon: DatabaseZap },
  { href: "/methodology", label: "Methodology", icon: ScrollText },
];

export function AdminShell({ role, principal, children }: { role: StaffRole; principal: Principal; children: React.ReactNode }) {
  const visibleLinks=links.filter(link=>!link.permission||principalHasPermission(principal,link.permission));
  return (
    <section className="mx-auto max-w-[1540px] px-4 py-6 sm:px-7 sm:py-10">
      <div className="overflow-hidden rounded-[32px] border border-black/[.08] bg-white shadow-[0_28px_90px_rgba(17,18,20,.08)] lg:grid lg:min-h-[800px] lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-black/[.07] bg-[#111214] p-5 text-white lg:border-b-0 lg:border-r lg:border-white/10 lg:p-6">
          <div className="flex items-start justify-between gap-4 lg:block">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-white/40">VIAL control plane</p>
              <p className="mt-2 text-xl font-semibold">Market operations</p>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-white/70">{role}</span>
          </div>
          <nav className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {visibleLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-white/65 hover:bg-white/10 hover:text-white">
                <Icon className="size-4" />{label}
              </Link>
            ))}
          </nav>
          <form action={logoutAction} className="mt-5 border-t border-white/10 pt-5">
            <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-white/55 hover:bg-white/10 hover:text-white"><LogOut className="size-4" />Sign out</button>
          </form>
        </aside>
        <div className="min-w-0 bg-[var(--background)] p-5 sm:p-8 lg:p-10">{children}</div>
      </div>
    </section>
  );
}
