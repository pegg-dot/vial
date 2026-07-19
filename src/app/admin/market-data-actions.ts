"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth/session";
import { runParserBenchmark } from "@/server/market-data/benchmarks";
import { rebuildCanonicalGraph } from "@/server/market-data/graph";
import { recomputeFreshness, recomputeSourceReliability } from "@/server/market-data/quality";
import { rebuildSearchIndex, seedSearchEvaluations } from "@/server/search/engine";
export async function rebuildGraphAction(){await requirePermission("catalog:write");await rebuildCanonicalGraph();revalidatePath("/admin/entities");}
export async function runBenchmarkAction(){await requirePermission("catalog:write");await runParserBenchmark("catalog");revalidatePath("/admin/benchmarks");revalidatePath("/admin/quality");}
export async function refreshQualityAction(){await requirePermission("catalog:write");await recomputeFreshness();await recomputeSourceReliability();revalidatePath("/admin/data-quality");}
export async function rebuildSearchAction(){await requirePermission("catalog:write");await rebuildSearchIndex();await seedSearchEvaluations();revalidatePath("/admin/search-quality");}
