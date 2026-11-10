import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";
import { Frame, Notice, PageHero, Pill, Section, UI } from "@/components/intelligence/research-ui";
import { unsubscribeAction } from "../actions";

export const metadata: Metadata = { title: "Unsubscribe | VialGrade", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const link = "font-bold text-[#2b31d8] underline underline-offset-4";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ id?: string; t?: string; result?: string }> }) {
  const { id, t, result } = await searchParams;
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["vial"]}
        breadcrumb={[{ href: "/intelligence", label: "Research" }, { href: "/intelligence/updates", label: "Monthly update" }, { label: "Unsubscribe" }]}
        eyebrow={<><Mail className="size-4" aria-hidden="true" /> Monthly update</>}
        title="Unsubscribe"
        lead="Stopping the monthly update deletes your address and consent record. There is nothing else to remove."
        actions={<Pill href="/legal/privacy" variant="ghost" arrow="right">Privacy notice</Pill>}
      />
      <Section narrow tight>
        <Frame pad="lg">
          {result === "ok" ? (
            <Notice tone="mint" role="status" icon={CheckCircle2}>
              <p>Done. Your email address and consent record were deleted and no more updates will be sent.</p>
            </Notice>
          ) : result === "invalid" ? (
            <Notice tone="warn" role="status">
              <p>This link is not valid. Email the address in the <Link href="/legal/privacy" className={link}>privacy notice</Link> and a person will delete your address.</p>
            </Notice>
          ) : id && t ? (
            <form action={unsubscribeAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="t" value={t} />
              <p className={UI.bodyInk + " text-base leading-7"}>Press the button to stop the monthly update and delete your email address from our list.</p>
              <Pill type="submit" variant="primary" className="mt-5">Unsubscribe and delete my address</Pill>
            </form>
          ) : (
            <p className={UI.bodyInk + " text-base leading-7"}>Use the unsubscribe link in any update email. If you cannot, see the <Link href="/legal/privacy" className={link}>privacy notice</Link> to ask for deletion.</p>
          )}
        </Frame>
      </Section>
    </div>
  );
}
