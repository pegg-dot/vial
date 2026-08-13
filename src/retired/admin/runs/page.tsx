import type { Metadata } from "next";
import { AgentRunTable } from "@/components/agent-run-table";
import { requireStaff } from "@/server/auth/session";
import { getRecentAgentRuns } from "@/server/catalog/repository";

export const metadata: Metadata = { title: "Run receipts" };
export const dynamic = "force-dynamic";
export default async function RunsPage(){await requireStaff();const runs=await getRecentAgentRuns(100);return <div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#2b31d8]">Bounded tool loops</p><h1 className="mt-3 text-4xl font-extrabold tracking-[-.055em] sm:text-5xl">Run receipts</h1><p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">Every workflow records its target, tools, proposed changes, publication count, duration, and terminal state. Page content never becomes agent instruction.</p><section className="ink hard mt-8 rounded-[20px] bg-white p-5 sm:p-7"><AgentRunTable runs={runs}/></section></div>}
