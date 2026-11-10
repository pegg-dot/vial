import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { UpdatesSignupForm } from "@/components/intelligence/updates-signup-form";
import { Frame, Notice, PageFootnote, PageHero, Pill, Section, UI } from "@/components/intelligence/research-ui";
import { emailConfig } from "@/server/email/resend";

export const metadata: Metadata = {
  title: "Monthly update email | VialGrade",
  description: "A monthly note when a ClinicalTrials.gov record we track changes. Email only; no account.",
  alternates: { canonical: "/intelligence/updates" },
  robots: { index: false, follow: true },
};
export const dynamic = "force-dynamic";

export default function UpdatesPage() {
  const available = emailConfig() !== null;
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["vial"]}
        breadcrumb={[{ href: "/intelligence", label: "Research" }, { label: "Monthly update" }]}
        eyebrow={<><Mail className="size-4" aria-hidden="true" /> Monthly update</>}
        title="Get a note when a source record changes."
        lead="Once a month, only if something changed, we email the ClinicalTrials.gov records we track for the compounds on this site that were edited. An edit is not a study result."
        note="You can unsubscribe from any email, or ask for deletion, at any time."
        actions={<Pill href="/legal/privacy" variant="ghost" arrow="right">Privacy notice</Pill>}
      />
      <Section narrow tight>
        <Frame pad="lg">
          <p className={UI.eyebrowMuted}>What we store, and what we never do</p>
          <ul className={UI.bodyInk + " mt-3 list-disc space-y-1.5 pl-5"}>
            <li>Email only. No account, no saved compounds, no searches, no interests.</li>
            <li>We store your address, the consent you gave, and when we last emailed you.</li>
            <li>Every email has an unsubscribe link that deletes your address immediately.</li>
            <li>Nothing is sent until you click the confirmation link. The confirmation link stops working after 3 days and unconfirmed requests are then deleted in a weekly cleanup.</li>
          </ul>
          {available ? <UpdatesSignupForm /> : (
            <Notice tone="warn" role="status" className="mt-6">
              <p>The update email is not switched on yet, so we are not collecting addresses. Please check back later.</p>
            </Notice>
          )}
        </Frame>
      </Section>
      <PageFootnote>
        Questions or deletion requests: see the <Link href="/legal/privacy" className="font-bold text-[#2b31d8] underline underline-offset-4">privacy notice</Link>.
        This is a research-evidence service; the email contains registry updates only.
      </PageFootnote>
    </div>
  );
}
