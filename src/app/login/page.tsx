import type { Metadata } from "next";
import { PasswordField } from "@/components/password-field";
import Link from "next/link";
import { CircleAlert, LogIn } from "lucide-react";
import { redirect } from "next/navigation";
import { Frame, IconTile, Notice, Pill, Section, UI } from "@/components/intelligence/research-ui";
import { loginAction } from "@/server/auth/actions";
import { getCurrentPrincipal } from "@/server/auth/principal";
export const metadata: Metadata = { title: "Sign in", description: "Sign in to your VialGrade account." };
const inline = "font-bold text-[#2b31d8] underline underline-offset-4";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const p = await searchParams;
  // Already signed in: show the account, not the form. `next` is ignored on purpose: a customer sent
  // here from /seller or /lab would otherwise bounce between the perimeter and this page forever.
  const principal = await getCurrentPrincipal();
  if (principal) redirect(principal.accountType === "staff" ? "/admin" : "/account");
  return (
    <Section narrow>
      <Frame shadow="lg" radius="rounded-[24px]" pad="lg" className="mx-auto max-w-[520px]">
        <IconTile icon={LogIn} tone="blue" />
        <h1 className={UI.h2 + " mt-6"}>Continue to VialGrade.</h1>
        {p.error && <Notice tone="danger" role="alert" icon={CircleAlert} className="mt-4"><p>{p.error}</p></Notice>}
        <form action={loginAction} className="mt-8 space-y-4">
          <input type="hidden" name="returnTo" value={p.next || "/account"} />
          <label className="block text-sm font-bold text-[#111214]">Email<input name="email" type="email" required className={UI.field + " mt-2"} /></label>
          <PasswordField name="password" required autoComplete="current-password" />
          {/* py-4 brings the pill to the fields' 52px height. */}
          <Pill type="submit" variant="primary" className="w-full py-4">Sign in</Pill>
        </form>
        <p className={UI.body + " mt-6 leading-7"}>New registrations are paused during the privacy review. You can <Link href="/intelligence" className={inline}>use public research without an account</Link>, or <Link href="/register" className={inline}>read the registration notice</Link>.</p>
        {process.env.NODE_ENV !== "production" && <p className={UI.small + " mt-6"}>Demo: nora@example.test / VialGradeDemoCustomer!2026</p>}
      </Frame>
    </Section>
  );
}
