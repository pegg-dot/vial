import { notFound } from "next/navigation";
import { SellerShell } from "@/components/seller/seller-shell";
import { requirePrincipal } from "@/server/auth/principal";
import { getSellerContext } from "@/server/seller/ops";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const principal = await requirePrincipal({ accountTypes: ["seller"] });
  const context = await getSellerContext(principal.email);
  if (!context) notFound();
  const readiness = context.readiness as { completion_percent?: unknown; overall_state?: unknown } | null;
  return <SellerShell sellerName={String(context.seller.display_name)} role={context.role} completion={Number(readiness?.completion_percent ?? 0)} readiness={String(readiness?.overall_state ?? "blocked")}>{children}</SellerShell>;
}
