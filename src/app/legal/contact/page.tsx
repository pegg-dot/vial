import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LEGAL_EMAIL, PRIVACY_EMAIL, RESPONSE_TARGET_DAYS } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Contact and corrections",
  description: "How to correct a record, dispute a grade or an enforcement entry, ask about your data, or send a legal notice.",
  alternates: { canonical: "/legal/contact" },
};

// /how-we-check promises that a flagged company gets "a way to dispute it", and grades publicly rate
// named real companies down to "avoid". This page is that way. It is deliberately built like the
// other legal pages rather than as a form: a mailbox a person reads is honest, and a contact form
// that posts into a table nobody watches is not.
function Mail({ address, subject }: { address: string; subject?: string }) {
  const href = subject ? `mailto:${address}?subject=${encodeURIComponent(subject)}` : `mailto:${address}`;
  return <a href={href} className="font-bold text-[#2b31d8] underline underline-offset-4">{address}</a>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-7">
      <h2 className="text-xl font-extrabold tracking-[-.03em]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-[var(--muted)]">{children}</div>
    </section>
  );
}

export default function Page() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#2b31d8]">Legal</p>
      <h1 className="mt-4 text-5xl font-extrabold tracking-[-.065em] sm:text-7xl">Contact and corrections</h1>
      <p className="mt-5 text-sm text-[var(--muted)]">Updated October 2026</p>
      <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">
        VialGrade currently publishes selected research-source records, not a peptide marketplace.
        You can request corrections to research information or ask about historical account records.
        Incoming email routing is still being verified, so time-sensitive legal or privacy notices
        should not be assumed delivered until receipt is confirmed.
      </p>

      <div className="ink hard mt-12 divide-y divide-[#111214]/10 rounded-[20px] bg-white px-6 sm:px-9">
        <Section title="Correct a record">
          <p>
            For an incorrect study identifier, sponsor, registered outcome, source link or publication date,
            email <Mail address={CONTACT_EMAIL} subject="Research correction" /> with the exact page URL,
            the questionable field and an original source that supports the correction.
          </p>
          <p>The source identity and original record must be verified before a correction can be published.</p>
        </Section>

        <Section title="Dispute a grade, a flag, or an enforcement entry">
          <p>
            Historic vendor grades, laboratory reports and commerce pages are not publicly active.
            If a retained historical record names your organization inaccurately, email <Mail address={CONTACT_EMAIL} subject="Historical record dispute" /> with its URL and the primary documentation at issue.
          </p>
          <p>Historical source rights and the corrections process remain under review. Do not assume an old marketplace score or assertion is currently endorsed.</p>
        </Section>

        <Section title="Ask about your data">
          <p>
            Email <Mail address={PRIVACY_EMAIL} subject="Data request" /> to get a copy of what is attached to your account, correct it, or delete it. There is no self-service delete button yet, so a person handles the request. What we hold and how long we keep it is set out in the{" "}
            <Link href="/legal/privacy" className="font-bold text-[#2b31d8] underline underline-offset-4">privacy notice</Link>.
          </p>
        </Section>

        <Section title="Legal notices">
          <p>
            Copyright, trademark, and other legal notices go to <Mail address={LEGAL_EMAIL} />. The{" "}
            <Link href="/legal/terms" className="font-bold text-[#2b31d8] underline underline-offset-4">terms of use</Link> list what a copyright complaint has to contain.
          </p>
        </Section>

        <Section title="What we cannot help with">
          <p>
            VialGrade does not offer public checkout or seller referrals. For orders placed directly with unrelated vendors, contact the vendor about shipments and refunds. If you have a legacy VialGrade sandbox order or a charge associated with VialGrade, contact us: previously created order, refund, return and dispute pathways remain separately reviewed. We do not provide medical, dosing or legal advice.
          </p>
        </Section>

        <Section title="What to expect">
          <p>
            Our stated target is {RESPONSE_TARGET_DAYS} days, subject to any shorter legal deadline.
            Email receiving and forwarding remain unverified. We cannot promise delivery or response until that is tested.
            We do not automatically publish or remove challenged scientific or historical claims.
          </p>
        </Section>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold text-[#2b31d8]">
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/terms">Terms</Link>
        <Link href="/legal/disclaimer">Disclaimer</Link>
        <Link href="/intelligence#method">Research methodology and limits</Link>
      </div>
    </div>
  );
}
