import { NextResponse } from "next/server";
import { requireApiSellerPermission } from "@/server/auth/principal";
import { getSellerContext, updateOnboardingStep, type OnboardingStepKey } from "@/server/seller/ops";
import { z } from "zod";

const schema = z.object({ step: z.enum(["business", "operations", "connect", "catalog", "evidence", "payments", "agreement", "review"]), payload: z.record(z.string(), z.unknown()).default({}), complete: z.boolean().default(false) });

export async function GET() {
  const auth = await requireApiSellerPermission("seller:profile:read");
  if (auth.response) return auth.response;
  const context = await getSellerContext(auth.principal.email);
  return context ? NextResponse.json({ onboarding: context.onboarding, steps: context.steps, readiness: context.readiness }) : NextResponse.json({ error: "Seller workspace not found" }, { status: 404 });
}

export async function POST(request: Request) {
  const auth = await requireApiSellerPermission("seller:onboarding:write");
  if (auth.response) return auth.response;
  const context = await getSellerContext(auth.principal.email);
  if (!context) return NextResponse.json({ error: "Seller workspace not found" }, { status: 404 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid onboarding payload", details: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await updateOnboardingStep({ sellerId: context.sellerId, step: parsed.data.step as OnboardingStepKey, payload: parsed.data.payload, complete: parsed.data.complete }));
}
