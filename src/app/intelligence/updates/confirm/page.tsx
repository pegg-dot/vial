import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";
import { Frame, Notice, PageHero, Pill, Section, UI } from "@/components/intelligence/research-ui";
import { confirmAction } from "../actions";

export const metadata: Metadata = { title: "Confirm your email | VialGrade", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const link = "font-bold text-[#2b31d8] underline underline-offset-4";

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ id?: string; t?: string; result?: string }> }) {
  const { id, t, result } = await searchParams;
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["vial"]}
        breadcrumb={[{ href: "/intelligence", label: "Research" }, { href: "/intelligence/updates", label: "Monthly update" }, { label: "Confirm" }]}
        eyebrow={<><Mail className="size-4" aria-hidden="true" /> Monthly update</>}
        title="Confirm your email"
        lead="Confirming tells us the address is yours. Nothing is sent before that."
        actions={<Pill href="/intelligence/updates" variant="ghost" arrow="right">About the monthly update</Pill>}
      />
      <Section narrow tight>
        <Frame pad="lg">
          {result === "ok" ? (
            <Notice tone="mint" role="status" icon={CheckCircle2}>
              <p>You are on the list. The next monthly update arrives only if a record we track has changed. Every email has an unsubscribe link.</p>
            </Notice>
          ) : result === "invalid" ? (
            <Notice tone="warn" role="status">
              <p>This confirmation link is not valid or has expired (requests expire after 3 days). Nothing was saved. You can <Link href="/intelligence/updates" className={link}>start again</Link>.</p>
            </Notice>
          ) : id && t ? (
            <form action={confirmAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="t" value={t} />
              <p className={UI.bodyInk + " text-base leading-7"}>Press the button to confirm you want the monthly update email.</p>
              <Pill type="submit" variant="primary" className="mt-5">Confirm my email address</Pill>
            </form>
          ) : (
            <p className={UI.bodyInk + " text-base leading-7"}>Open the confirmation link from your email. Or <Link href="/intelligence/updates" className={link}>request a new one</Link>.</p>
          )}
        </Frame>
      </Section>
    </div>
  );
}
