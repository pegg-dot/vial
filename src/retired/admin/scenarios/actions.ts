"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth/session";
import { runScenario } from "@/server/internal-ops/repository";

export async function runScenarioAction(formData: FormData) {
  await requirePermission("admin:manage");
  await runScenario(String(formData.get("scenario") ?? "price_drop"));
  revalidatePath("/admin/scenarios");
}
