import { LogOut } from "lucide-react";
import Link from "next/link";
import type { StaffRole } from "@/server/auth/session";
import type { Principal } from "@/server/auth/types";
import { logoutAction } from "@/app/admin/actions";
import { AdminNav } from "./admin-nav";

/**
 * The admin chrome.
 *
 * This used to be a 40-link control plane covering seller onboarding, settlements, underwriting,
 * fraud cases, agent evals and so on — surfaces that have been retired from the product. Every one
 * of those links pointed at a page that no longer exists, so the sidebar was a wall of 404s.
 *
 * There are six admin pages now, so the chrome carries the pipeline as a row of steps — see
 * admin-nav. Still no sidebar: it is one path, not a tree.
 */
export function AdminShell({ role, principal, children }: { role: StaffRole; principal: Principal; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-[1540px] px-4 py-6 sm:px-7 sm:py-8">
      <header className="ink hard mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[18px] bg-[#111214] px-5 py-4 text-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm font-black uppercase tracking-[.18em]">VialGrade admin</Link>
            <span className="rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em]">{role}</span>
          </div>
          <AdminNav />
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-white/60">
          <span className="hidden sm:inline">{principal.email}</span>
          <Link href="/" className="hover:text-white">View site</Link>
          <form action={logoutAction}>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 font-bold text-white transition hover:bg-white/20">
              <LogOut className="size-3.5" /> Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </section>
  );
}
