import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Frame, IconTile, Pill, Section, UI } from "@/components/intelligence/research-ui";

export const metadata: Metadata = {
  title: "New account registration paused",
  robots: { index: false, follow: true },
};

export default function RegisterPage() {
  return (
    <Section narrow>
      <Frame shadow="lg" radius="rounded-[22px]" pad="lg" className="mx-auto max-w-[600px]">
        <IconTile icon={UserPlus} tone="blue" />
        <h1 className={UI.h2 + " mt-6"}>New account registration is paused.</h1>
        <p className={UI.body + " mt-4 leading-7"}>
          VialGrade is reviewing how saved compounds, searches, preferences and alerts
          might reveal health interests. Public research records remain available without
          an account. We are not accepting new personal profiles during this review.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Pill href="/intelligence" variant="ink" arrow="right">Explore public research</Pill>
          <Pill href="/login" variant="secondary">Sign in to an existing account</Pill>
        </div>
        <p className={UI.small + " mt-6 leading-6"}>
          Existing users can contact us about account data and deletion through the{" "}
          <Link href="/legal/privacy" className="font-bold text-[#2b31d8] underline underline-offset-4">privacy notice</Link>.
        </p>
      </Frame>
    </Section>
  );
}
