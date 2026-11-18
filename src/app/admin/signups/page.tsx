import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { principalHasPermission } from "@/server/auth/permissions";
import { getSignupOverview } from "@/server/digest/signup-overview";
import { SignupTable } from "@/components/admin/signup-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Signups" };

const LIMIT = 1000;

/**
 * Everyone on the email list, newest first. List administration, not analytics: the list holds an
 * address, the consent given and three dates, and is never joined to what anyone read. Addresses
 * are shown only to staff whose role may read personal data; others see them masked.
 */
export default async function AdminSignupsPage() {
  const principal = await getCurrentPrincipal();
  if (!principal || principal.accountType !== "staff") redirect("/admin/login?next=%2Fadmin%2Fsignups");
  const showAddresses = principalHasPermission(principal, "privacy:read");
  const signups = await getSignupOverview({ limit: LIMIT });

  return (
    <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8">
      <Link href="/admin#signups" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] hover:text-[#111214]"><ArrowLeft className="size-4" /> Overview</Link>
      <p className="mt-6 text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Signups</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">Email list</h1>
      <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
        {signups.total.toLocaleString()} on the list: {signups.confirmed.toLocaleString()} confirmed, {signups.confirmationSent.toLocaleString()} sent a confirmation link,
        {" "}{signups.waiting.toLocaleString()} waiting for the update email to start. Unsubscribing deletes the row, so nobody who left is here.
        {!showAddresses && " Your role does not include reading personal data, so addresses are masked."}
      </p>
      <div className="ink hard mt-6 overflow-hidden rounded-[18px] bg-white">
        <SignupTable rows={signups.rows} showAddresses={showAddresses} />
      </div>
      {signups.total > signups.rows.length && (
        <p className="mt-2 text-xs font-medium tabular-nums text-[var(--muted)]">Showing the {signups.rows.length.toLocaleString()} most recent of {signups.total.toLocaleString()}.</p>
      )}
    </div>
  );
}
