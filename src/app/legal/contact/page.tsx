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
      <p className="mt-5 text-sm text-[var(--muted)]">Updated August 2026</p>
      <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">
        VialGrade publishes grades, flags, and enforcement records about real companies. Anyone named here can challenge what we say, and a person reads every message.
      </p>

      <div className="ink hard mt-12 divide-y divide-[#111214]/10 rounded-[20px] bg-white px-6 sm:px-9">
        <Section title="Correct a record">
          <p>
            If something on VialGrade about your company or your laboratory is wrong — a price, a batch, a lab result, a link, a closed business still listed as trading — email{" "}
            <Mail address={CONTACT_EMAIL} subject="Correction" />. Include the page URL, what is wrong, and what the correct information is. Point us at the public source if there is one; it is the fastest way to get the record changed.
          </p>
          <p>
            Corrections are made against the record itself. We keep the original snapshot, because the history of what a source said is the point of the archive — but the live page shows the corrected value.
          </p>
        </Section>

        <Section title="Dispute a grade, a flag, or an enforcement entry">
          <p>
            A grade is derived from evidence we can show you, and no accusation is published anonymously. If you think a grade, a warning flag, or an enforcement entry is wrong, email{" "}
            <Mail address={CONTACT_EMAIL} subject="Dispute" /> with the URL, which specific claim you dispute, and anything that contradicts it — a lab report, a batch record, a resolved regulatory matter, a corrected product page.
          </p>
          <p>
            A person re-reviews it against the underlying evidence. If we got it wrong, the record is corrected and the correction is dated. If it stands, you get the reason and the evidence it rests on. A low grade is not removed for being unflattering, and a disputed claim is not left standing without an answer.
          </p>
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
            VialGrade sells nothing and never handles an order, so we cannot track a shipment, refund a purchase, or resolve a dispute with a vendor — that is between you and the company you bought from. We also do not give medical, dosing, or legal advice, and we do not recommend a vendor or a compound to anyone.
          </p>
        </Section>

        <Section title="What to expect">
          <p>
            We aim to reply within {RESPONSE_TARGET_DAYS} days. A correction with a verifiable source is usually faster than a dispute that needs the evidence re-examined. Every message is read by a person; nothing on this site is published or unpublished automatically.
          </p>
        </Section>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold text-[#2b31d8]">
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/terms">Terms</Link>
        <Link href="/legal/disclaimer">Disclaimer</Link>
        <Link href="/how-we-check">How we check</Link>
      </div>
    </div>
  );
}
