import type { Metadata } from "next";
import Link from "next/link";
import { UpdatesSignupForm } from "@/components/intelligence/updates-signup-form";
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
    <div className="mx-auto max-w-[760px] px-5 py-16 sm:px-8 sm:py-20">
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#2b31d8]">Monthly update</p>
      <h1 className="mt-3 text-balance text-[clamp(2.2rem,5vw,3.4rem)] font-extrabold leading-[.98] tracking-[-.045em]">Get a note when a source record changes.</h1>
      <p className="mt-4 text-base font-medium leading-7 text-[#3a3d46]">Once a month, only if something changed, we email the ClinicalTrials.gov records we track for the compounds on this site that were edited. An edit is not a study result.</p>
      <ul className="mt-5 list-disc space-y-1 pl-5 text-sm font-medium leading-6 text-[#3a3d46]">
        <li>Email only. No account, no saved compounds, no searches, no interests.</li>
        <li>We store your address, the consent you gave, and when we last emailed you.</li>
        <li>Every email has an unsubscribe link that deletes your address immediately.</li>
        <li>Nothing is sent until you click the confirmation link. The confirmation link stops working after 3 days and unconfirmed requests are then deleted in a weekly cleanup.</li>
      </ul>
      {available ? <UpdatesSignupForm /> : (
        <p role="status" className="mt-6 rounded-xl border-2 border-[#111214] bg-[#fff3d8] p-4 text-sm font-semibold leading-6">The update email is not switched on yet, so we are not collecting addresses. Please check back later.</p>
      )}
      <p className="mt-8 text-xs font-medium leading-6 text-[#666970]">
        Questions or deletion requests: see the <Link href="/legal/privacy" className="font-bold text-[#2b31d8] underline underline-offset-4">privacy notice</Link>. This is a research-evidence service; the email contains registry updates only.
      </p>
    </div>
  );
}
